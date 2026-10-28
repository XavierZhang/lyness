/**
 * The filesystem of the person whose turn this is — on their own machine.
 *
 * Phase one of the hosted product runs the agent loop on the server and the
 * work on the desktop: the loop has to be on the server or credits and the
 * model policy have nowhere to hold, while the files belong to the person
 * ([decision](../../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md)).
 * This backend is the filesystem end of that split.
 *
 * It answers the question `FileSystem` never asks — whose machine? — from
 * the session the turn belongs to. The session records its owner when it is
 * opened (`@lyness/lyn-session-ownership`); a call outside any turn falls
 * back to the person the request authenticated as; a call that is neither
 * fails rather than guessing a machine.
 *
 * @module @lyness/lyn-fs-desktop
 */

import { posix, win32 } from 'node:path'
import { FileSystem, FsError, FsVersion } from '@lyness/lyn-fs'
import type {
  FsDirEntry,
  FsEditOutcome,
  FsEditRequest,
  FsInfo,
  FsPathInfo,
  FsTarget,
  FsWriteIntent,
  FsWriteOutcome,
} from '@lyness/lyn-fs'
import type { SandboxExecutionPolicy } from '@lyness/lyn-sandbox'
import type {} from '@lyness/lyn-agent'
import type {} from '@lyness/lyn-desktop-link'
import type {} from '@lyness/lyn-session-ownership'
import { ownerOf } from '@lyness/lyn-session-ownership'
import type {} from '@lyness/lyn-request-principal'
import type { PersonId } from '@lyness/lyn-people'
import type { JsonValue } from '@lyness/lyn-util-values'
import { z } from 'zod'
import {
  FS_CAPABILITY,
  desktopTargetSchema,
  dirEntrySchema,
  editOutcomeSchema,
  infoSchema,
  pathInfoSchema,
  failureSchema,
  successOf,
  writeOutcomeSchema,
} from './protocol.ts'
import type { DesktopTarget } from './protocol.ts'
import { decodeTarget, encodeTarget } from './targets.ts'

export { decodeTarget, encodeTarget } from './targets.ts'
export * from './protocol.ts'

/** The reply schemas, built once rather than per call. */
const replies = {
  target: successOf(desktopTargetSchema),
  info: successOf(infoSchema.nullable()),
  pathInfo: successOf(pathInfoSchema.nullable()),
  text: successOf(z.string()),
  bytes: successOf(z.base64()),
  entries: successOf(z.array(dirEntrySchema)),
  write: successOf(writeOutcomeSchema),
  edit: successOf(editOutcomeSchema),
  end: successOf(z.null()),
}

/** Filesystem calls performed on the owning person's own desktop. */
export class DesktopFileSystem extends FileSystem {
  static inject = ['desktopLink', 'sessionProjections']

  override async resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget> {
    return encodeTarget(await this.request('resolve', { path, cwd: opts?.cwd ?? null }, replies.target, opts?.signal))
  }

  override processPath(target: FsTarget): string {
    return decodeTarget(target).processPath
  }

  override fileUrl(target: FsTarget): string {
    return decodeTarget(target).fileUrl
  }

  override contains(parent: FsTarget, child: FsTarget): boolean {
    const from = decodeTarget(parent)
    const to = decodeTarget(child)
    return containsPath(from.platform, from.processPath, to.processPath)
  }

  override async stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined> {
    const info = await this.request('stat', { target: decodeTarget(target) }, replies.info, signal)
    if (info === null) return undefined
    return { version: FsVersion(info.version), type: info.type, ...info.size === undefined ? {} : { size: info.size } }
  }

  override async lstat(path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<FsPathInfo | undefined> {
    const info = await this.request('lstat', { path, cwd: opts?.cwd ?? null }, replies.pathInfo, signal)
    if (info === null) return undefined
    return { version: FsVersion(info.version), type: info.type, ...info.size === undefined ? {} : { size: info.size } }
  }

  override readText(target: FsTarget, signal?: AbortSignal): Promise<string> {
    return this.request('readText', { target: decodeTarget(target) }, replies.text, signal)
  }

  override streamText(target: FsTarget, signal?: AbortSignal): Promise<AsyncIterable<string>> {
    const chunks = this.chunks(target, signal)
    return Promise.resolve(chunks)
  }

  override async readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array> {
    const encoded = await this.request('readBytes', { target: decodeTarget(target), maxBytes }, replies.bytes, signal)
    return Buffer.from(encoded, 'base64')
  }

  override async readByteRange(target: FsTarget, range: { offset: number; length: number }, signal?: AbortSignal): Promise<Uint8Array> {
    const encoded = await this.request('readByteRange', { target: decodeTarget(target), ...range }, replies.bytes, signal)
    return Buffer.from(encoded, 'base64')
  }

  override async listDir(target: FsTarget, signal?: AbortSignal): Promise<FsDirEntry[]> {
    const entries = await this.request('listDir', { target: decodeTarget(target) }, replies.entries, signal)
    return entries.map(entry => ({
      name: entry.name,
      type: entry.type,
      target: encodeTarget(entry.target),
      ...entry.version === undefined ? {} : { version: FsVersion(entry.version) },
      ...entry.size === undefined ? {} : { size: entry.size },
    }))
  }

  override async writeText(
    target: FsTarget,
    content: string,
    expected?: FsWriteIntent,
    signal?: AbortSignal,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsWriteOutcome> {
    const outcome = await this.request(
      'writeText',
      { target: decodeTarget(target), content, expected: expected ?? null, policy: policyPayload(sandboxPolicy) },
      replies.write,
      signal,
    )
    return { ...outcome, version: FsVersion(outcome.version) }
  }

  override async editText(
    target: FsTarget,
    edit: FsEditRequest,
    expected?: { version: FsVersion },
    signal?: AbortSignal,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsEditOutcome> {
    const outcome = await this.request(
      'editText',
      {
        target: decodeTarget(target),
        edit: { oldString: edit.oldString, newString: edit.newString, replaceAll: edit.replaceAll },
        expected: expected ?? null,
        policy: policyPayload(sandboxPolicy),
      },
      replies.edit,
      signal,
    )
    return { ...outcome, version: FsVersion(outcome.version) }
  }

  /**
   * Whose desktop this call belongs to.
   *
   * The turn's session is the authority: an agent reads and writes on behalf
   * of whoever opened the conversation, not whoever happens to be calling
   * the API at that instant. Outside a turn — a direct call on an API route —
   * the authenticated person is the only answer there is.
   */
  private person(): PersonId {
    const agent = this.ctx.get('agents')?.currentInitiator()
    const owner = agent === undefined ? undefined : ownerOf(this.ctx, agent.session)
    const person = owner?.owner ?? this.ctx.get('requestPrincipal')?.current()?.person
    if (person === undefined) {
      throw new FsError('this call belongs to no signed-in person, so it reaches no desktop', 'FS_IO_ERROR')
    }
    return person
  }

  /** Perform one operation on the desktop and return its single value. */
  private async request<T>(
    operation: string,
    payload: JsonValue,
    schema: z.ZodType<{ ok: true; value: T }>,
    signal?: AbortSignal,
  ): Promise<T> {
    let last: JsonValue = null
    for await (const item of this.calls(operation, payload, signal)) last = item
    return this.value(schema, last, signal)
  }

  /** Stream one text read, yielding each chunk as the desktop produces it. */
  private async *chunks(target: FsTarget, signal?: AbortSignal): AsyncIterable<string> {
    const sent = decodeTarget(target)
    let previous: JsonValue | undefined
    for await (const item of this.calls('streamText', { target: sent }, signal)) {
      if (previous !== undefined) yield this.value(replies.text, previous, signal)
      previous = item
    }
    // The last reply is the call's outcome, not a chunk: it reports the
    // failure a read can still hit after its first bytes are already out.
    this.value(replies.end, previous ?? null, signal)
  }

  /** Every reply to one call, with the link's own failures mapped into the taxonomy. */
  private async *calls(operation: string, payload: JsonValue, signal?: AbortSignal): AsyncIterable<JsonValue> {
    const person = this.person()
    try {
      yield* this.ctx.desktopLink.call(person, FS_CAPABILITY, operation, payload, signal)
    } catch (error) {
      throw new FsError(
        error instanceof Error ? error.message : String(error),
        signal?.aborted === true ? 'FS_ABORTED' : 'FS_IO_ERROR',
        { cause: error },
      )
    }
  }

  /** Validate one reply and raise its failure as an {@link FsError}. */
  private value<T>(schema: z.ZodType<{ ok: true; value: T }>, raw: JsonValue, signal?: AbortSignal): T {
    const failed = failureSchema.safeParse(raw)
    if (failed.success) throw new FsError(failed.data.message, failed.data.code)
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new FsError(
        `the desktop answered this filesystem call with something it does not understand: ${parsed.error.message}`,
        signal?.aborted === true ? 'FS_ABORTED' : 'FS_IO_ERROR',
      )
    }
    return parsed.data.value
  }
}

/**
 * The per-call confinement as the link carries it.
 *
 * The desktop applies its own default when the Host's caller named none; the
 * server does not get to decide how a person's own machine confines itself,
 * only to pass on a narrower policy a tool already resolved.
 * @param policy - the policy the caller supplied, if any.
 * @returns the JSON the desktop reads, or null for "your own default".
 */
function policyPayload(policy: SandboxExecutionPolicy | undefined): JsonValue {
  if (policy === undefined) return null
  return {
    mode: policy.mode,
    workspaceRoot: policy.workspaceRoot,
    ...policy.sessionId === undefined ? {} : { sessionId: String(policy.sessionId) },
  }
}

/**
 * Whether `child` is `parent` or sits under it, in the desktop's own path flavour.
 * @param platform - which path flavour the desktop speaks.
 * @param parent - the candidate ancestor's process path.
 * @param child - the candidate descendant's process path.
 * @returns true when `child` is `parent` or a descendant of it.
 */
export function containsPath(platform: DesktopTarget['platform'], parent: string, child: string): boolean {
  const paths = platform === 'win32' ? win32 : posix
  const relative = paths.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${paths.sep}`) && relative !== '..' && !paths.isAbsolute(relative))
}

export default DesktopFileSystem
