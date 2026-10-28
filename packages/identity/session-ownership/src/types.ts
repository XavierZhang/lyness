/**
 * What a session records about whose conversation it is.
 *
 * @module @deepseek-ai/dsh-session-ownership/types
 */

import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'

/** Format of the ownership record; a later shape bumps it. */
export const SESSION_OWNER_RECORD_VERSION = 1

/**
 * The attribution of record for one session.
 *
 * Two fields rather than one, because a person is not an organization. One
 * person holds one identity and may hold several standings at once, so
 * "which organization" is a property of the act rather than of the person:
 * a conversation opened while acting for Acme is Acme's, whatever else its
 * owner belongs to.
 *
 * The standing is recorded rather than derived, because both sides of it
 * move. Someone who leaves Acme and joins Globex must not drag three months
 * of Acme's conversations into Globex's account, and an organization reading
 * its own history has to see what was true when each conversation happened.
 */
export interface SessionOwnerRecord {
  /** Format of this record. */
  readonly version: number
  /** The person who opened the conversation. */
  readonly owner: PersonId
  /** The standing they held it open under; absent when they acted as themselves. */
  readonly membership?: MembershipId | undefined
  /** When it was opened, as a UTC instant. */
  readonly openedAt: string
}
