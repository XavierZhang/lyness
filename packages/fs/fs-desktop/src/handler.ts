/**
 * The desktop's end of its own filesystem: serve what the server asks, from
 * the machine the person is sitting at.
 *
 * It is a handler rather than a service because the desktop already has a
 * `FileSystem` — its local one. This adds no filesystem; it exposes the one
 * that is there to exactly one caller, the server that person is signed in
 * to, through the link that server already holds.
 *
 * Confinement stays local for the same reason. The server may pass on a
 * policy a tool resolved, and the desktop's own backend enforces it; a
 * server that could widen it would be deciding what a person's own machine
 * allows.
 *
 * @module @deepseek-ai/dsh-fs-desktop/handler
 */

import { FsError, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { FileSystem, FsTarget, FsWriteIntent } from '@deepseek-ai/dsh-fs'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { DesktopHandler } from '@deepseek-ai/dsh-desktop-link/executor'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { z } from 'zod'
import {
  desktopTargetSchema,
  editRequestSchema,
  sandboxPolicySchema,
  writeIntentSchema,
} from './protocol.ts'
import type { DesktopTarget } from './protocol.ts'

/** The path flavour this machine speaks, which the Host needs for `contains`. */
const platform: DesktopTarget['platform'] = process.platform === 'win32' ? 'win32' : 'posix'

const targetArg = z.object({ target: desktopTargetSchema }).strict()
const pathArg = z.object({ path: z.string(), cwd: z.string().nullable() }).strict()
const boundedArg = z.object({ target: desktopTargetSchema, maxBytes: z.number() }).strict()
const rangeArg = z.object({ target: desktopTargetSchema, offset: z.number(), length: z.number() }).strict()
const writeArg = z.object({
  target: desktopTargetSchema,
  content: z.string(),
  expected: writeIntentSchema.nullable(),
  policy: sandboxPolicySchema.nullable(),
}).strict()
const editArg = z.object({
  target: desktopTargetSchema,
  edit: editRequestSchema,
  expected: z.object({ version: z.string() }).strict().nullable(),
  policy: sandboxPolicySchema.nullable(),
}).strict()

/**
 * Serve this machine's filesystem to the server the person is signed in to.
 * @param fs - the desktop's own filesystem backend.
 * @returns the handler to register under the `fs` capability.
 */
export function desktopFsHandler(fs: FileSystem): DesktopHandler {
  return {
    perform: (operation, payload, signal) => perform(fs, operation, payload, signal),
  }
}

/** One call, with every outcome — including failure — reported as a value. */
async function* perform(fs: FileSystem, operation: string, payload: JsonValue, signal: AbortSignal): AsyncIterable<JsonValue> {
  try {
    yield* run(fs, operation, payload, signal)
  } catch (error) {
    yield failure(error)
  }
}

/** Dispatch one operation, letting failures reach {@link perform}. */
async function* run(fs: FileSystem, operation: string, payload: JsonValue, signal: AbortSignal): AsyncIterable<JsonValue> {
  switch (operation) {
    case 'resolve': {
      const { path, cwd } = pathArg.parse(payload)
      yield ok(describe(fs, await fs.resolve(path, { ...cwd === null ? {} : { cwd }, signal })))
      return
    }
    case 'stat': {
      const info = await fs.stat(rebuild(targetArg.parse(payload).target), signal)
      yield ok(info === undefined ? null : { ...info, version: String(info.version) })
      return
    }
    case 'lstat': {
      const { path, cwd } = pathArg.parse(payload)
      const info = await fs.lstat(path, cwd === null ? {} : { cwd }, signal)
      yield ok(info === undefined ? null : { ...info, version: String(info.version) })
      return
    }
    case 'readText':
      yield ok(await fs.readText(rebuild(targetArg.parse(payload).target), signal))
      return
    case 'streamText': {
      for await (const chunk of await fs.streamText(rebuild(targetArg.parse(payload).target), signal)) yield ok(chunk)
      yield ok(null)
      return
    }
    case 'readBytes': {
      const { target, maxBytes } = boundedArg.parse(payload)
      yield ok(Buffer.from(await fs.readBytes(rebuild(target), signal, maxBytes)).toString('base64'))
      return
    }
    case 'readByteRange': {
      const { target, offset, length } = rangeArg.parse(payload)
      yield ok(Buffer.from(await fs.readByteRange(rebuild(target), { offset, length }, signal)).toString('base64'))
      return
    }
    case 'listDir': {
      const entries = await fs.listDir(rebuild(targetArg.parse(payload).target), signal)
      yield ok(entries.map(entry => ({
        name: entry.name,
        type: entry.type,
        target: describe(fs, entry.target),
        ...entry.version === undefined ? {} : { version: String(entry.version) },
        ...entry.size === undefined ? {} : { size: entry.size },
      })))
      return
    }
    case 'writeText': {
      const { target, content, expected, policy } = writeArg.parse(payload)
      const outcome = await fs.writeText(rebuild(target), content, intent(expected), signal, confinement(policy))
      yield ok({ ...outcome, version: String(outcome.version) })
      return
    }
    case 'editText': {
      const { target, edit, expected, policy } = editArg.parse(payload)
      const guard = expected === null ? undefined : { version: FsVersion(expected.version) }
      const outcome = await fs.editText(rebuild(target), edit, guard, signal, confinement(policy))
      yield ok({ ...outcome, version: String(outcome.version) })
      return
    }
    default:
      throw new FsError(`this desktop's filesystem serves no "${operation}" operation`, 'FS_IO_ERROR')
  }
}

/** Describe one local target so the Host's synchronous members can answer. */
function describe(fs: FileSystem, target: FsTarget): DesktopTarget {
  return {
    key: String(target.targetKey),
    displayPath: target.displayPath,
    processPath: fs.processPath(target),
    fileUrl: fs.fileUrl(target),
    platform,
  }
}

/** Recover the local target from what the Host sent back. */
function rebuild(target: DesktopTarget): FsTarget {
  return { targetKey: FsTargetKey(target.key), displayPath: target.displayPath }
}

/** The write guard, as the local backend takes it. */
function intent(expected: z.infer<typeof writeIntentSchema> | null): FsWriteIntent | undefined {
  if (expected === null) return undefined
  if (expected.kind === 'createIfAbsent') return { kind: 'createIfAbsent' }
  return { kind: 'replaceIfVersion', version: FsVersion(expected.version) }
}

/** The per-call confinement, or the backend's own default when none was named. */
function confinement(policy: z.infer<typeof sandboxPolicySchema> | null): SandboxExecutionPolicy | undefined {
  if (policy === null) return undefined
  return {
    mode: policy.mode,
    workspaceRoot: policy.workspaceRoot,
    ...policy.sessionId === undefined ? {} : { sessionId: brandString<SessionId>(policy.sessionId) },
  }
}

/** One successful value, in the envelope the Host validates. */
function ok(value: JsonValue): JsonValue {
  return { ok: true, value }
}

/** One failure, carrying the code the Host's consumers route on. */
function failure(error: unknown): JsonValue {
  const code = error instanceof FsError ? error.code : 'FS_IO_ERROR'
  return { ok: false, code, message: error instanceof Error ? error.message : String(error) }
}
