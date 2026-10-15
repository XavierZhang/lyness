/**
 * Vocabulary for the context a call declares and the refusals that follow.
 *
 * @module @lyness/lyn-acting-context/types
 */

import type { MembershipId } from '@lyness/lyn-people'

/**
 * What a call says it is acting as.
 *
 * Personal is a value rather than an absence so that "stated nothing" and
 * "stated the personal context" are different inputs. A person holding two
 * memberships makes a default a guess, and a guess here attributes a
 * conversation to the wrong organization — so the absent case is refused and
 * cannot be reached by forgetting a field.
 */
export type DeclaredContext =
  | { readonly kind: 'personal' }
  | { readonly kind: 'membership'; readonly membership: MembershipId }

/** Why a declared context was refused. */
export type RefusalCode =
  /** The call stated no context at all. */
  | 'context-absent'
  /** The stated standing does not exist. */
  | 'membership-unknown'
  /** The stated standing belongs to somebody else. */
  | 'membership-not-held'
  /** The address resolves to an organization this context does not belong to. */
  | 'context-outside-address'
