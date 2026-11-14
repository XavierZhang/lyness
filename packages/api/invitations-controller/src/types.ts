/**
 * Wire vocabulary of the invitations surface, and its failure codes.
 *
 * Views rather than the seam's own records: what crosses the wire is what
 * each invitation grants, how long it lasts, how much of it is left, and
 * whether it can still be redeemed — never the stored hash, and never the
 * code itself except in the answer to the call that issued it.
 * @module @deepseek-ai/dsh-api-invitations-controller/types
 */

import type { Role } from '@deepseek-ai/dsh-people/types'

export type { Role } from '@deepseek-ai/dsh-people/types'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The calling standing may not issue or withdraw that invitation: it
     * reached for another organization, or for a standing it does not hold.
     */
    'invitations/not-permitted': Record<string, never>
    /**
     * The submission left something out. `fields` names what, so a form marks
     * them together.
     */
    'invitations/incomplete': { readonly fields: readonly string[] }
    /**
     * The submission asks for more uses or a longer life than this deployment
     * allows. The bounds are configuration, so a surface reports the refusal
     * rather than naming a limit of its own.
     */
    'invitations/out-of-bounds': Record<string, never>
    /** No invitation of that identity exists, or it was already withdrawn. */
    'invitations/unknown': Record<string, never>
    /**
     * The call established no standing to act in. Unreachable where the
     * deployment mounts an authorization rule, which refuses such a call
     * before it arrives; reachable where it mounts none, and refused here
     * rather than issuing an invitation on nobody's authority.
     */
    'invitations/no-standing': Record<string, never>
    /**
     * The call presented no identity, so there is nobody to accept an
     * invitation as. Unreachable where the deployment mounts an authorization
     * rule, which refuses such a call before it arrives.
     */
    'invitations/no-identity': Record<string, never>
  }
}

/** One invitation, as the administration surface shows it. */
export interface InvitationRowView {
  /** Stable identity, for the call that withdraws it. */
  readonly id: string
  /** What the issuer wrote to recognize it. */
  readonly label: string
  /** The standing a redemption grants. */
  readonly role: Role
  /** The organization that standing is in; absent for a platform administrator. */
  readonly organization?: string
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
   * The code itself, present only in the answer to `issue`.
   *
   * The deployment keeps only its hash, so the list never carries it: an
   * administrator who loses it issues another invitation rather than reading
   * this one back.
   */
  readonly code?: string
}

/**
 * What one acceptance did, as the person who accepted it sees it.
 *
 * One answer for every refusal: a wrong code, a spent one, an expired one,
 * one whose issuer no longer holds the standing, one granting what this
 * person already holds, and one the roster refuses to write all read as
 * `accepted: false`. Telling them apart would let anybody signed in learn
 * which codes exist and what authority they carry.
 */
export interface AcceptanceView {
  /** Whether the code granted this person a standing. */
  readonly accepted: boolean
  /** What they now hold; absent when the code granted them nothing. */
  readonly role?: Role
  /** The organization that standing is in; absent for a platform administrator, and when nothing was granted. */
  readonly organization?: string
}

/** What an administrator submits to issue one invitation. */
export interface InvitationInput {
  /** What to call it in the list: a name, an address, a team. */
  readonly label: string
  /** The standing a redemption grants. */
  readonly role: Role
  /** The organization that standing is in; absent for a platform administrator. */
  readonly organization?: string
  /** How many redemptions to allow; absent takes the deployment's default. */
  readonly maxUses?: number
  /** How long it stays redeemable, in milliseconds; absent takes the deployment's default. */
  readonly lifetimeMs?: number
}
