/**
 * The authenticated person a Microsoft Entra sign-in establishes.
 * @module @lyness/lyn-microsoft-entra/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** Entra's stable object id for one person, unique within its directory. */
export type EntraObjectId = Branded<'EntraObjectId'>

/** Entra's directory (tenant) id. */
export type EntraDirectoryId = Branded<'EntraDirectoryId'>

/**
 * One signed-in person, as the directory reports them.
 *
 * `objectId` paired with `directoryId` is the identity other work binds to: a
 * display name and an address both change, while the object id does not.
 */
export interface EntraSubject {
  /** Stable directory identity. */
  readonly objectId: EntraObjectId
  /** The directory that authenticated them. */
  readonly directoryId: EntraDirectoryId
  /** Display name, as the directory holds it; absent when the directory publishes none. */
  readonly displayName?: string
  /** Sign-in address, as the directory holds it; absent when the directory publishes none. */
  readonly address?: string
}
