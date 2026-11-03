/**
 * Vocabulary for DingTalk sign-in: the two identities its directory answers
 * with, and the subject this integration hands a sign-in.
 *
 * @module @lyness/lyn-dingtalk/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** An organization's own id, which DingTalk calls `corpId`. */
export type DingtalkCorpId = Branded<'DingtalkCorpId'>

/**
 * One person's id across everything one DingTalk developer account can see,
 * which DingTalk calls `unionId`.
 *
 * The union id rather than the open id: an open id is per application, so a
 * binding written against one would stop matching the moment a deployment
 * registered a second application for the same organization.
 */
export type DingtalkUnionId = Branded<'DingtalkUnionId'>

/** One person, as the organization's directory reports them. */
export interface DingtalkSubject {
  /** The organization that authenticated them. */
  readonly corpId: DingtalkCorpId
  /** Their id across this developer account, stable across renames. */
  readonly unionId: DingtalkUnionId
  /** Nickname the directory holds, when it publishes one. */
  readonly nick?: string | undefined
  /** Address the directory holds, when it publishes one. */
  readonly email?: string | undefined
}
