/**
 * The vocabulary the two halves of the desktop filesystem speak over one
 * desktop link.
 *
 * Both halves live in this package because they must agree: the Host encodes
 * a call here and the desktop decodes it here, and a capability whose two
 * ends can drift is a capability that fails in production rather than at
 * build time.
 *
 * The link carries JSON, so every value crossing it is validated on arrival
 * even though both ends are this repository's own code.
 *
 * @module @deepseek-ai/dsh-fs-desktop/protocol
 */

import { FS_ERROR_CODES } from '@deepseek-ai/dsh-fs'
import { z } from 'zod'

/** The capability name the Host addresses and the desktop registers. */
export const FS_CAPABILITY = 'fs'

/** Which path flavour the desktop's own filesystem speaks. */
export const platformSchema = z.enum(['posix', 'win32'])

/**
 * One target as the desktop describes it.
 *
 * `key` is the desktop backend's own opaque key, carried back unread so a
 * follow-up call reaches the same file. The remaining fields are what
 * `FileSystem`'s synchronous
 * members must answer without a round-trip, which is why the desktop sends
 * them with the target rather than on request.
 */
export const desktopTargetSchema = z.object({
  key: z.string(),
  displayPath: z.string(),
  processPath: z.string(),
  fileUrl: z.string(),
  platform: platformSchema,
}).strict()

/** One target as the desktop describes it. */
export type DesktopTarget = z.infer<typeof desktopTargetSchema>

/** Target metadata, with the opaque version as the wire carries it. */
export const infoSchema = z.object({
  version: z.string(),
  type: z.enum(['file', 'directory', 'other']),
  size: z.number().optional(),
}).strict()

/** Path metadata, which unlike {@link infoSchema} can report a symlink. */
export const pathInfoSchema = z.object({
  version: z.string(),
  type: z.enum(['file', 'directory', 'symlink', 'other']),
  size: z.number().optional(),
}).strict()

/** One direct child of a listed directory. */
export const dirEntrySchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory', 'other']),
  target: desktopTargetSchema,
  version: z.string().optional(),
  size: z.number().optional(),
}).strict()

/** The guard a write runs under. */
export const writeIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('createIfAbsent') }).strict(),
  z.object({ kind: z.literal('replaceIfVersion'), version: z.string() }).strict(),
])

/** The outcome of a full-file write. */
export const writeOutcomeSchema = z.object({
  operation: z.enum(['create', 'update']),
  version: z.string(),
  before: z.string().nullable(),
  after: z.string(),
}).strict()

/** The outcome of a literal edit. */
export const editOutcomeSchema = z.object({
  version: z.string(),
  before: z.string(),
  after: z.string(),
}).strict()

/** A literal-replacement edit request. */
export const editRequestSchema = z.object({
  oldString: z.string(),
  newString: z.string(),
  replaceAll: z.boolean(),
}).strict()

/** The per-call confinement the Host passes through, when its caller supplied one. */
export const sandboxPolicySchema = z.object({
  mode: z.enum(['read-only', 'workspace-write', 'danger-full-access']),
  workspaceRoot: z.string(),
  sessionId: z.string().optional(),
}).strict()

/** The failure arm on its own, for the desktop half that produces it. */
export const failureSchema = z.object({
  ok: z.literal(false),
  code: z.enum(FS_ERROR_CODES),
  message: z.string(),
}).strict()

/**
 * How a failure travels.
 *
 * A failure is a value rather than a thrown handler error because the link's
 * own failure channel carries only text, and a filesystem failure that
 * arrives without its `FsErrorCode` is one the retry, permission, and UI
 * layers can no longer route on. A success is the same envelope with `ok`
 * true and the operation's own value beside it.
 * @param value - the success schema for the operation being decoded.
 * @returns the schema for that operation's successful reply.
 */
export function successOf<T extends z.ZodType>(value: T): z.ZodObject<{ ok: z.ZodLiteral<true>; value: T }> {
  return z.object({ ok: z.literal(true), value }).strict()
}
