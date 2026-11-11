/**
 * Host Remote owner of the `invitations` namespace: administrators issue the
 * codes that admit somebody the roster has never heard of, read what still
 * stands, and withdraw one.
 *
 * Who may issue what is not decided here. The invitations seam holds those
 * rules — an invitation grants no more than its issuer holds, and nobody
 * reaches outside the organization they administer — and this namespace hands
 * it the caller's standing and reports what it answered. A second rule
 * written here would be one to keep in step with the first, and the one a
 * direct caller bypasses.
 *
 * @module @lyness/lyn-api-invitations-controller
 */

import { Context } from '@lyness/cordis'
import { InvitationRefusedError } from '@lyness/lyn-invitations'
import type {
  InvitationId, InvitationRefusal, InvitationSubmission, InvitationView,
} from '@lyness/lyn-invitations'
import { brandString } from '@lyness/lyn-brand'
import type { Membership } from '@lyness/lyn-people'
import { callingStanding } from '@lyness/lyn-request-principal'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { assertNever } from '@lyness/lyn-util-values'
import type { InvitationInput, InvitationRowView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `invitations` Remote namespace. */
    invitationsController: InvitationsController
  }
}

/** Host service backing the generated `ctx.remote.invitations` namespace. */
export default class InvitationsController extends TypertRemoteService {
  /**
   * Register the invitations namespace.
   * @param ctx - Host context where the invitations and the principal are mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'invitationsController', { namespace: 'invitations', requires: 'tenant-administrator' })
  }

  /**
   * The invitations the calling standing administers, newest first.
   * @returns their views, without codes.
   * @throws {RemoteError} `invitations/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment issues none.
   */
  @Remote
  async list(): Promise<readonly InvitationRowView[]> {
    const invitations = this.issuing()
    return (await invitations.list(await this.calling())).map(view)
  }

  /**
   * Issue one invitation, and answer the code once.
   *
   * The code is in this answer and nowhere else, so a surface shows it to
   * the administrator now or not at all.
   * @param input - what the administrator filled in.
   * @returns the invitation, with its code.
   * @throws {RemoteError} `invitations/not-permitted`, `invitations/incomplete`,
   * `invitations/out-of-bounds`, `invitations/no-standing`, or `gateway/internal`.
   */
  @Remote
  async issue(input: InvitationInput): Promise<InvitationRowView> {
    const invitations = this.issuing()
    const by = await this.calling()
    const submission: InvitationSubmission = {
      label: input.label,
      role: input.role,
      ...input.organization === undefined ? {} : { organization: input.organization },
      ...input.maxUses === undefined ? {} : { maxUses: input.maxUses },
      ...input.lifetimeMs === undefined ? {} : { lifetimeMs: input.lifetimeMs },
    }
    try {
      return view(await invitations.issue(submission, by))
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Withdraw one invitation, so a code already sent stops working.
   *
   * The row stays, revoked: who invited whom is why the record is kept.
   * @param id - the invitation to withdraw.
   * @throws {RemoteError} `invitations/not-permitted`, `invitations/unknown`,
   * `invitations/no-standing`, or `gateway/internal`.
   */
  @Remote
  async revoke(id: string): Promise<void> {
    const invitations = this.issuing()
    const by = await this.calling()
    try {
      await invitations.revoke(brandString<InvitationId>(id), by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /** The invitations seam, where this deployment issues any. */
  private issuing(): Context['invitations'] {
    const invitations = this.ctx.get('invitations')
    if (invitations === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment issues no invitations', {
        endpoint: 'invitations',
      })
    }
    return invitations
  }

  /**
   * The standing this call acts in.
   *
   * Resolved rather than assumed: where a deployment mounts no authorization
   * rule, every call reaches here, and a code admitting somebody on no
   * standing would be one nobody is answerable for.
   */
  private async calling(): Promise<Membership> {
    const held = await callingStanding(this.ctx)
    if (held === undefined) throw new RemoteError('invitations/no-standing', 'this call acts in no standing', {})
    return held
  }
}

/**
 * Project one invitation onto its wire view.
 * @param invitation - the invitation as the seam answers it.
 * @returns the view this namespace answers with.
 */
function view(invitation: InvitationView): InvitationRowView {
  return {
    id: invitation.id,
    label: invitation.label,
    role: invitation.role,
    ...invitation.organization === undefined ? {} : { organization: invitation.organization },
    issuedAt: invitation.issuedAt,
    expiresAt: invitation.expiresAt,
    maxUses: invitation.maxUses,
    uses: invitation.uses,
    open: invitation.open,
    ...invitation.code === undefined ? {} : { code: invitation.code },
  }
}

/**
 * One refusal from the seam, as the wire reports it; anything else as itself.
 * @param refused - what the seam threw.
 * @returns the error to throw.
 */
function refusal(refused: unknown): unknown {
  if (!(refused instanceof InvitationRefusedError)) return refused
  return reported(refused.reason, refused.message)
}

/**
 * The failure one refusal is reported as.
 * @param reason - which rule refused it.
 * @param message - the seam's own words.
 * @returns the error to throw.
 */
function reported(reason: InvitationRefusal, message: string): RemoteError {
  switch (reason) {
    case 'not-permitted': return new RemoteError('invitations/not-permitted', message, {})
    case 'organization-required':
      return new RemoteError('invitations/incomplete', message, { fields: ['organization'] })
    case 'out-of-bounds': return new RemoteError('invitations/out-of-bounds', message, {})
    case 'unknown': return new RemoteError('invitations/unknown', message, {})
    /* v8 ignore next -- closed-union exhaustiveness guard; the seam names one of the four above. */
    default: return assertNever(reason, 'invitation refusal')
  }
}
