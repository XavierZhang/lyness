/**
 * Vocabulary of invitations: what an administrator issues, what a deployment
 * stores, and what a surface shows.
 *
 * @module @lyness/lyn-invitations/types
 */

import type { Branded } from '@lyness/lyn-brand'
import type { MembershipId, PersonId, Role } from '@lyness/lyn-people'

/** Opaque identity of one invitation, safe to show and to address. */
export type InvitationId = Branded<'InvitationId'>

/**
 * The secret somebody redeems, which the issuer sends them.
 *
 * It is returned once, by the call that issues it, and never again: the
 * deployment keeps only its hash, so a stolen store cannot be redeemed from
 * and a surface cannot show a code a second time.
 */
export type InvitationCode = Branded<'InvitationCode'>

/** One invitation as the deployment stores it. */
export interface InvitationRecord {
  /** Stable identity, generated here and never reused. */
  readonly id: InvitationId
  /** SHA-256 of the code, base64url, so the store holds no redeemable secret. */
  readonly codeHash: string
  /** What the issuer wrote to recognize it: a name, an address, a team. */
  readonly label: string
  /** The standing a redemption grants. */
  readonly role: Role
  /** The organization that standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /** The person who issued it. */
  readonly issuedBy: PersonId
  /**
   * The standing they issued it in.
   *
   * Kept so redemption can ask whether that standing still holds: an
   * invitation carries no more authority than its issuer still has, so one
   * issued by an administrator who has since been removed is void.
   */
  readonly issuedIn: MembershipId
  /** When it was issued, as a UTC instant. */
  readonly issuedAt: string
  /** When it stops being redeemable, as a UTC instant. */
  readonly expiresAt: string
  /** How many redemptions it allows in total. */
  readonly maxUses: number
  /** How many it has had. */
  readonly uses: number
  /** When an administrator withdrew it, as a UTC instant; absent while it stands. */
  readonly revokedAt?: string | undefined
}

/** What an administrator fills in to issue one. */
export interface InvitationSubmission {
  /** What to call it in the list, and what to call the person it admits until their directory names them. */
  readonly label: string
  /** The standing a redemption grants. */
  readonly role: Role
  /** The organization that standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /** How many redemptions to allow; absent takes the deployment's default. */
  readonly maxUses?: number | undefined
  /** How long it stays redeemable, in milliseconds; absent takes the deployment's default. */
  readonly lifetimeMs?: number | undefined
}

/** Why an invitation was refused, as a caller may act on it. */
export type InvitationRefusal =
  /** The standing may not issue or withdraw this one. */
  | 'not-permitted'
  /** A tenant administrator's standing needs an organization. */
  | 'organization-required'
  /** The submission asks for more uses or a longer life than this deployment allows. */
  | 'out-of-bounds'
  /** No invitation of that identity exists. */
  | 'unknown'

/** One invitation as a surface shows it. */
export interface InvitationView {
  /** Stable identity, for the call that withdraws it. */
  readonly id: InvitationId
  /** What the issuer wrote to recognize it. */
  readonly label: string
  /** The standing a redemption grants. */
  readonly role: Role
  /** The organization that standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /** When it was issued, as a UTC instant. */
  readonly issuedAt: string
  /** When it stops being redeemable, as a UTC instant. */
  readonly expiresAt: string
  /** How many redemptions it allows. */
  readonly maxUses: number
  /** How many it has had. */
  readonly uses: number
  /** Whether it can still be redeemed right now. */
  readonly open: boolean
  /**
   * The code itself, returned only by the call that issued it.
   *
   * Absent everywhere else, because the deployment keeps only its hash: an
   * administrator who loses it issues another one rather than reading this
   * one back.
   */
  readonly code?: InvitationCode | undefined
}
