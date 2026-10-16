/**
 * Vocabulary for WeCom sign-in: the two identities a corporation's directory
 * answers with, and the subject this integration hands a sign-in.
 *
 * @module @lyness/lyn-wecom/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** A corporation's own id, which WeCom calls `corpid`. */
export type WecomCorpId = Branded<'WecomCorpId'>

/** One member's id inside that corporation, which WeCom calls `userid`. */
export type WecomUserId = Branded<'WecomUserId'>

/** One member, as the corporation's directory reports them. */
export interface WecomSubject {
  /** The corporation that authenticated them. */
  readonly corpId: WecomCorpId
  /** Their id within it, stable across renames. */
  readonly userId: WecomUserId
  /** Name the directory holds, when the deployment reads member detail. */
  readonly name?: string | undefined
  /** Work address the directory holds, when the deployment reads member detail. */
  readonly email?: string | undefined
}
