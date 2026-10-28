/**
 * Carrying a desktop's target across a boundary that has no memory.
 *
 * `FileSystem.processPath`, `fileUrl`, and `contains` are synchronous, and a
 * machine on the other side of a link cannot answer synchronously. So the
 * desktop sends everything those three need with the target itself, and the
 * target key carries it: the key is opaque by contract, which is exactly the
 * licence to put the record there instead of in a cache the provider would
 * then have to keep, invalidate, and bound.
 *
 * @module @lyness/lyn-fs-desktop/targets
 */

import { FsError, FsTargetKey } from '@lyness/lyn-fs'
import type { FsTarget } from '@lyness/lyn-fs'
import { desktopTargetSchema } from './protocol.ts'
import type { DesktopTarget } from './protocol.ts'

/**
 * Turn what the desktop sent into the target its consumers pass around.
 * @param target - the record the desktop produced for one file.
 * @returns the harness-side target carrying that record in its key.
 */
export function encodeTarget(target: DesktopTarget): FsTarget {
  return { targetKey: FsTargetKey(JSON.stringify(target)), displayPath: target.displayPath }
}

/**
 * Recover the desktop's record from a target this backend produced.
 * @param target - a target to send back to the desktop or answer about.
 * @returns the record the desktop sent with it.
 * @throws {FsError} `FS_IO_ERROR` when the target came from another backend.
 */
export function decodeTarget(target: FsTarget): DesktopTarget {
  const parsed = desktopTargetSchema.safeParse(read(target))
  if (!parsed.success) {
    throw new FsError(`"${target.displayPath}" was not resolved by the desktop filesystem`, 'FS_IO_ERROR')
  }
  return parsed.data
}

/** The key's JSON, or `null` when it holds none. */
function read(target: FsTarget): unknown {
  try {
    return JSON.parse(String(target.targetKey))
  } catch {
    // A key from another backend is a plain path, not JSON; `decodeTarget`
    // reports it against the path the caller can recognize.
    return null
  }
}
