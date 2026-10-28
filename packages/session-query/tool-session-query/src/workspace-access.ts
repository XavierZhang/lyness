/**
 * Caller identity, workspace authorization, and visible lineage projection.
 *
 * @module @deepseek-ai/dsh-tool-session-query/workspace-access
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import {
  type Session,
  type SessionHeader,
  type SessionId as SessionIdValue,
} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-ownership/visibility'
import type { TurnBoundaryProjection } from '@deepseek-ai/dsh-agent'
import type {
  SessionLineageNode,
  SessionRecord,
} from '@deepseek-ai/dsh-session-query'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session-projection'
import { serviceBoundary } from './service-boundary.ts'

interface Caller {
  readonly id: SessionIdValue
  readonly header: SessionHeader
  /** The conversation this Agent is running in, which bounds what it may read. */
  readonly session: Session
  /** The caller's own-session boundary fold (the `turnBoundary` projection). */
  readonly boundary: TurnBoundaryProjection | undefined
}

interface TitleView {
  readonly text: string
  readonly unavailableCode?: string
}

interface CompleteTitleMap extends ReadonlyMap<SessionIdValue, TitleView> {
  get(id: SessionIdValue): TitleView
}

interface AuthorizedDescendant {
  readonly record: SessionRecord
  readonly descendants: Array<AuthorizedDescendant | null>
}

interface DescendantProjectionFrame {
  readonly node: SessionLineageNode
  readonly target: Array<AuthorizedDescendant | null>
  readonly next: DescendantProjectionFrame | undefined
}

interface DescendantVisit {
  readonly node: AuthorizedDescendant | null
  readonly depth: number
  readonly next: DescendantVisit | undefined
}

function callerOf(exec: ToolRunContext, ctx: Context): Caller {
  const agent = exec.agent
  if (agent === undefined) {
    throw new HarnessError(
      'session query tools require an agent-bound caller',
      'SESSION_QUERY_TOOL_MISSING_AGENT',
    )
  }
  return {
    id: agent.session.id,
    header: agent.session.header,
    session: agent.session,
    boundary: ctx.sessionProjections.stateOf(agent.session, 'turnBoundary'),
  }
}

/**
 * Whether the caller's conversation may read one session, beside the
 * workspace rule.
 *
 * A workspace is a path, and on a deployment that serves named people two of
 * them can be working in the same one; the path says where a conversation
 * happened, not whose it is. Where no deployment mounts the ownership rule —
 * one operator at the keyboard — the workspace stays the whole answer.
 * @param ctx - Host context where the rule may be mounted.
 * @param caller - the conversation this tool call runs in.
 * @param header - the session being considered.
 * @returns true when the caller's conversation may read it.
 */
async function ownerAuthorized(ctx: Context, caller: Caller, header: SessionHeader): Promise<boolean> {
  const visibility = ctx.get('sessionVisibility')
  return visibility === undefined || await visibility.mayReadFrom(caller.session, header)
}

function targetId(args: { readonly session_id?: string }, caller: Caller): SessionIdValue {
  return args.session_id === undefined ? caller.id : brandString<SessionIdValue>(args.session_id)
}

async function authorizeTarget(
  ctx: Context,
  caller: Caller,
  target: SessionIdValue,
  signal: AbortSignal,
): Promise<void> {
  if (target === caller.id) return
  const cwd = caller.header.cwd
  if (cwd === undefined) throw serviceBoundary.unauthorizedTarget()
  const records = await serviceBoundary.call(ctx, signal, 'target authorization', () =>
    ctx.sessionQuery.filterSessions([
      { kind: 'id', values: [target] },
      { kind: 'cwd', values: [cwd] },
    ], signal))
  const found = records[0]
  if (records.length !== 1 || found === undefined) throw serviceBoundary.unauthorizedTarget()
  if (!await ownerAuthorized(ctx, caller, found.header)) throw serviceBoundary.unauthorizedTarget()
}

function recordAuthorized(record: SessionRecord, caller: Caller): boolean {
  return headerAuthorized(record.header, caller)
}

function headerAuthorized(header: SessionHeader, caller: Caller): boolean {
  if (header.id === caller.id) return header.cwd === caller.header.cwd
  return caller.header.cwd !== undefined && header.cwd === caller.header.cwd
}

function assertObservedTargetAuthorized(
  caller: Caller,
  target: SessionIdValue,
  observed: SessionHeader,
): void {
  if (observed.id !== target || !headerAuthorized(observed, caller)) {
    throw serviceBoundary.unauthorizedTarget()
  }
}

async function authorizeSessionIds(
  ctx: Context,
  caller: Caller,
  ids: readonly SessionIdValue[],
  signal: AbortSignal,
): Promise<ReadonlySet<SessionIdValue>> {
  const unique = [...new Set(ids)]
  const authorized = new Set<SessionIdValue>()
  if (unique.includes(caller.id)) authorized.add(caller.id)
  const cwd = caller.header.cwd
  const other = unique.filter(id => id !== caller.id)
  if (cwd === undefined || other.length === 0) return authorized
  const records = await serviceBoundary.call(ctx, signal, 'session-id authorization', () =>
    ctx.sessionQuery.filterSessions([
      { kind: 'id', values: other },
      { kind: 'cwd', values: [cwd] },
    ], signal))
  const requested = new Set(other)
  for (const record of records) {
    if (requested.has(record.header.id)
      && recordAuthorized(record, caller)
      && await ownerAuthorized(ctx, caller, record.header)) {
      authorized.add(record.header.id)
    }
  }
  return authorized
}

async function readTitles(
  ctx: Context,
  caller: Caller,
  ids: readonly SessionIdValue[],
  signal: AbortSignal,
): Promise<CompleteTitleMap> {
  const result = new Map<SessionIdValue, TitleView>()
  const observations = await serviceBoundary.call(ctx, signal, 'title observation', () =>
    ctx.sessionQuery.readTitleSnapshots(ids, signal))
  for (const observation of observations) {
    if (observation.status === 'rejected') {
      result.set(observation.sessionId, unavailableTitle(ctx, observation.reason))
      continue
    }
    assertObservedTargetAuthorized(caller, observation.sessionId, observation.value.session)
    result.set(observation.sessionId, { text: observation.value.title?.title ?? 'untitled' })
  }
  return result as CompleteTitleMap
}

async function readTitle(
  ctx: Context,
  caller: Caller,
  id: SessionIdValue,
  signal: AbortSignal,
): Promise<TitleView> {
  return (await readTitles(ctx, caller, [id], signal)).get(id)
}

function unavailableTitle(
  ctx: Context,
  error: unknown,
): TitleView {
  const sanitized = serviceBoundary.sanitizeError(ctx, 'title observation item', error)
  if (sanitized.code === 'SESSION_QUERY_TOOL_UNAUTHORIZED') throw sanitized
  return { text: 'untitled', unavailableCode: sanitized.code }
}

function authorizeDescendants(
  nodes: readonly SessionLineageNode[],
  caller: Caller,
): Array<AuthorizedDescendant | null> {
  const result: Array<AuthorizedDescendant | null> = []
  let pending: DescendantProjectionFrame | undefined
  for (const node of [...nodes].reverse()) {
    pending = { node, target: result, next: pending }
  }
  while (pending !== undefined) {
    const current = pending
    pending = current.next
    if (!recordAuthorized(current.node.session, caller)) {
      current.target.push(null)
      continue
    }
    const projected: AuthorizedDescendant = {
      record: current.node.session,
      descendants: [],
    }
    current.target.push(projected)
    for (const child of [...current.node.descendants].reverse()) {
      pending = {
        node: child,
        target: projected.descendants,
        next: pending,
      }
    }
  }
  return result
}

function * visitDescendants(
  nodes: readonly (AuthorizedDescendant | null)[],
): Generator<DescendantVisit> {
  let pending: DescendantVisit | undefined
  for (const node of [...nodes].reverse()) {
    pending = { node, depth: 0, next: pending }
  }
  while (pending !== undefined) {
    const current = pending
    pending = current.next
    yield current
    if (current.node === null) continue
    for (const child of [...current.node.descendants].reverse()) {
      pending = {
        node: child,
        depth: current.depth + 1,
        next: pending,
      }
    }
  }
}

function descendantIds(nodes: readonly (AuthorizedDescendant | null)[]): SessionIdValue[] {
  const ids: SessionIdValue[] = []
  for (const { node } of visitDescendants(nodes)) {
    if (node !== null) ids.push(node.record.header.id)
  }
  return ids
}

function titleText(view: TitleView): string {
  return view.unavailableCode === undefined
    ? view.text
    : `${view.text} (title unavailable: ${view.unavailableCode})`
}

/** Workspace-scoped caller authorization, title access, and lineage projection. */
export const workspaceAccess = {
  callerOf,
  ownerAuthorized,
  targetId,
  authorizeTarget,
  recordAuthorized,
  assertObservedTargetAuthorized,
  authorizeSessionIds,
  readTitles,
  readTitle,
  authorizeDescendants,
  visitDescendants,
  descendantIds,
  titleText,
}
