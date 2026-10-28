/** Reconnect-safe Workspace baseline and increment producer. */

import type { Context } from '@deepseek-ai/cordis'
import { Deque } from '@deepseek-ai/dsh-deque'
import { assertNever } from '@deepseek-ai/dsh-util-values'
import type { Principal } from '@deepseek-ai/dsh-request-principal'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import type { Workspace, WorkspaceRecord } from '@deepseek-ai/dsh-workspace'
import {
  workspaceDomainState,
  workspaceRecord,
  WorkspaceId,
} from '@deepseek-ai/dsh-workspace'
import { keepVisible, visibleSessions } from './visible-sessions.ts'
import type { VisibleSessions } from './visible-sessions.ts'
import type {
  WorkspaceBaseline,
  WorkspaceFollowFrame,
  WorkspaceFollowIncrement,
  WorkspaceView,
} from './types.ts'

/**
 * Project one authoritative Workspace entity into its Remote value.
 *
 * A Workspace is shared and its accounted conversations are not, so the
 * caller reads what it may name first and passes it here: the projection
 * cannot be built without answering whose conversations it names.
 * @param workspace - authoritative registry entity.
 * @param visible - the conversations this call may name.
 * @returns detached Workspace projection for Remote consumers.
 */
export function workspaceView(workspace: Workspace, visible: VisibleSessions): WorkspaceView {
  return {
    workspaceId: workspace.id,
    path: workspace.path,
    title: workspace.title,
    sessionIds: keepVisible(workspace.sessionIds, visible),
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  }
}

function changedWorkspaceView(workspaceId: string, value: unknown): WorkspaceView {
  const record: WorkspaceRecord = workspaceRecord.parse(value)
  return {
    workspaceId: WorkspaceId(workspaceId),
    path: record.path,
    title: record.title,
    sessionIds: [...record.sessionIds],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/**
 * Narrow one published increment to the conversations its reader may name.
 *
 * The domain observation that produces an increment belongs to whoever
 * committed the write, so narrowing happens once per reader on the sending
 * path rather than at publication.
 * @param frame - the increment as the registry committed it.
 * @param visible - the conversations this generation's reader may name.
 * @returns the increment this reader receives.
 */
function visibleIncrement(
  frame: WorkspaceFollowIncrement,
  visible: VisibleSessions,
): WorkspaceFollowIncrement {
  switch (frame.type) {
    case 'upsert':
      return {
        type: 'upsert',
        workspace: { ...frame.workspace, sessionIds: keepVisible(frame.workspace.sessionIds, visible) },
      }
    case 'archived':
      return { type: 'archived', archivedSessionIds: keepVisible(frame.archivedSessionIds, visible) }
    case 'pinned':
      return { type: 'pinned', pinnedSessionIds: keepVisible(frame.pinnedSessionIds, visible) }
    // Workspace identity and registry order name no conversation.
    case 'remove':
    case 'order':
      return frame
    /* v8 ignore next 2 -- closed-union exhaustiveness guard */
    default:
      return assertNever(frame, 'workspace follow increment')
  }
}

/** Owns Workspace domain observation and all active follow generations. */
export class WorkspaceFeed {
  private readonly followers = new Set<WorkspaceFollower>()
  private knownIds: Set<string>
  private order: readonly string[]
  private archived: readonly string[]
  private pinned: readonly string[]

  /** @param ctx - Host context containing the authoritative Workspace registry. */
  constructor(private readonly ctx: Context) {
    const baseline = ctx.workspaceRegistry.list()
    this.knownIds = new Set(baseline.map(workspace => String(workspace.id)))
    this.order = baseline.map(workspace => String(workspace.id))
    this.archived = ctx.workspaceRegistry.archivedSessionIds.map(String)
    this.pinned = ctx.workspaceRegistry.pinnedSessionIds.map(String)
    ctx.on('domain/changed', (change: DomainChanged) => { this.changed(change) })
    ctx.effect(() => () => {
      for (const follower of this.followers) follower.close()
      this.followers.clear()
    }, 'workspace-controller.feed')
  }

  /**
   * Read the complete current projection synchronously.
   * @param visible - the conversations this call may name.
   * @returns all active Workspaces plus archived and pinned Session identities.
   */
  baseline(visible: VisibleSessions): WorkspaceBaseline {
    return {
      items: this.ctx.workspaceRegistry.list().map(workspace => workspaceView(workspace, visible)),
      archivedSessionIds: keepVisible(this.ctx.workspaceRegistry.archivedSessionIds, visible),
      pinnedSessionIds: keepVisible(this.ctx.workspaceRegistry.pinnedSessionIds, visible),
    }
  }

  /**
   * Open one generation beginning with a complete baseline.
   *
   * The generation speaks for whoever opened it for as long as it runs: its
   * frames are pulled by the transport long after that request returned, so
   * the principal is captured here and re-entered to read what each frame
   * may name.
   * @param signal - generation cancellation.
   * @returns baseline followed by ordered Workspace increments.
   */
  async *follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrame> {
    signal.throwIfAborted()
    const reader = this.ctx.get('requestPrincipal')?.current()
    const follower = new WorkspaceFollower()
    this.followers.add(follower)
    try {
      yield { type: 'baseline', value: this.baseline(await this.visible(reader, signal)) }
      for await (const frame of follower.read(signal)) {
        yield visibleIncrement(frame, await this.visible(reader, signal))
      }
    } finally {
      this.followers.delete(follower)
      follower.close()
    }
  }

  /** What one generation's reader may name, read as that reader rather than as the pump. */
  private visible(reader: Principal | undefined, signal: AbortSignal): Promise<VisibleSessions> {
    const principals = this.ctx.get('requestPrincipal')
    if (principals === undefined) return visibleSessions(this.ctx, signal)
    return principals.as(reader, () => visibleSessions(this.ctx, signal))
  }

  private changed(change: DomainChanged): void {
    if (change.domain !== 'workspace') return
    if (change.table === '') {
      if (change.operation !== 'put') return
      const state = workspaceDomainState.parse(change.value)
      const nextOrder = state.workspaceIds.map(String)
      const orderChanged = !sameStrings(this.order, nextOrder)
      for (const id of state.workspaceIds) {
        if (this.knownIds.has(id)) continue
        const workspace = this.ctx.workspaceRegistry.get(id)
        if (workspace === undefined) {
          throw new Error(`committed Workspace registry references missing Workspace "${id}"`)
        }
        this.knownIds.add(id)
        // Published unnarrowed: each generation narrows the frame for its own reader.
        this.publish({ type: 'upsert', workspace: workspaceView(workspace, undefined) })
      }
      this.order = nextOrder
      if (orderChanged) this.publish({ type: 'order', workspaceIds: [...state.workspaceIds] })
      const nextArchived = state.archivedSessionIds.map(String)
      if (!sameStrings(this.archived, nextArchived)) {
        this.archived = nextArchived
        this.publish({ type: 'archived', archivedSessionIds: [...state.archivedSessionIds] })
      }
      const nextPinned = state.pinnedSessionIds.map(String)
      if (!sameStrings(this.pinned, nextPinned)) {
        this.pinned = nextPinned
        this.publish({ type: 'pinned', pinnedSessionIds: [...state.pinnedSessionIds] })
      }
      return
    }
    if (change.table !== 'workspaces') return
    if (change.operation === 'deleted') {
      if (!this.knownIds.delete(change.key)) return
      this.publish({ type: 'remove', workspaceId: WorkspaceId(change.key) })
      return
    }
    if (!this.knownIds.has(change.key)) return
    this.publish({
      type: 'upsert',
      workspace: changedWorkspaceView(change.key, change.value),
    })
  }

  private publish(frame: WorkspaceFollowIncrement): void {
    for (const follower of this.followers) follower.push(frame)
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

class WorkspaceFollower {
  private readonly frames = new Deque<WorkspaceFollowIncrement>()
  private waiting: (() => void) | undefined
  private closed = false

  push(frame: WorkspaceFollowIncrement): void {
    /* v8 ignore next -- closed followers are removed before later publication can reach them. */
    if (this.closed) return
    this.frames.pushBack(frame)
    this.waiting?.()
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.waiting?.()
  }

  async *read(signal: AbortSignal): AsyncIterable<WorkspaceFollowIncrement> {
    while (!this.closed && !signal.aborted) {
      const frame = this.frames.popFront()
      if (frame !== undefined) {
        yield frame
        continue
      }
      await this.wait(signal)
    }
  }

  private wait(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        signal.removeEventListener('abort', finish)
        /* v8 ignore next -- one read owns the sole installed wait callback. */
        if (this.waiting === finish) this.waiting = undefined
        resolve()
      }
      this.waiting = finish
      signal.addEventListener('abort', finish, { once: true })
      /* v8 ignore next -- native signals and the private queue cannot change during this synchronous setup. */
      if (signal.aborted || this.closed || this.frames.size > 0) finish()
    })
  }
}
