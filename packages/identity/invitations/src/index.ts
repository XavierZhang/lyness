/**
 * Invitations: how somebody nobody has heard of joins a deployment.
 *
 * An administrator issues a code that carries one standing — a role, and the
 * organization it is in — and sends it to a person. That person signs in
 * through a directory the deployment accepts, presents the code, and becomes a
 * roster entry with exactly that standing. Without a code they are refused, as
 * every unadmitted subject is.
 *
 * The code is the authority, and it is bounded on every side: it grants only
 * what its issuer could have granted directly, it expires, it allows a counted
 * number of redemptions, an administrator can withdraw it, and it is void once
 * the standing that issued it is gone. The deployment stores only its hash.
 *
 * Why here rather than in the roster: the roster answers who exists, and every
 * one of its writes is an administrator's. A redemption is the one write a
 * stranger causes, so it is bounded by its own record and recorded in the same
 * trail — kept apart from the roster rather than folded into it.
 *
 * @module @deepseek-ai/dsh-invitations
 */

import { createHash, randomBytes } from 'node:crypto'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { administers } from '@deepseek-ai/dsh-people'
import type { Membership, MembershipId, PersonId, Role } from '@deepseek-ai/dsh-people'
import { PeopleRefusedError } from '@deepseek-ai/dsh-managed-people'
import type { ExternalSubject } from '@deepseek-ai/dsh-sign-in'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type {} from '@deepseek-ai/dsh-admin-audit'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { invitationsDomain } from './storage.ts'
import type {
  InvitationCode, InvitationId, InvitationRecord, InvitationRefusal, InvitationSubmission, InvitationView,
} from './types.ts'

export type * from './types.ts'
export { invitationsDomain, invitationSchema } from './storage.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The invitations this deployment has issued; absent where it issues none. */
    invitations: Invitations
  }
}

/** Message an issue or withdrawal a standing may not make is refused with. */
export const NOT_PERMITTED = 'invitations: that standing may not issue or withdraw this invitation'

/** Message a tenant administrator's invitation without an organization is refused with. */
export const ORGANIZATION_REQUIRED = 'invitations: a tenant administrator\'s invitation names the organization it is in'

/** Message a submission outside this deployment's bounds is refused with. */
export const OUT_OF_BOUNDS = 'invitations: that many uses or that long a life is more than this deployment allows'

/** Message a withdrawal of an invitation nobody holds is refused with. */
export const UNKNOWN = 'invitations: no invitation of that identity exists'

/** A week: long enough to reach somebody who was away, short enough to stop mattering. */
export const DEFAULT_LIFETIME_MS = 7 * 24 * 3_600_000

/** A month: past this, a link somebody forwarded is a standing door. */
export const MAX_LIFETIME_MS = 30 * 24 * 3_600_000

/** One redemption, which is what an invitation to a named person is. */
export const DEFAULT_MAX_USES = 1

/** A seat count, not a public signup page: past this, issue one per person. */
export const MAX_USES_LIMIT = 200

/** What this deployment allows an invitation to be. */
export interface Config {
  /** How long an invitation stays redeemable when its issuer names no lifetime, in milliseconds. */
  defaultLifetimeMs?: number
  /** How long the longest-lived invitation may stay redeemable, in milliseconds. */
  maxLifetimeMs?: number
  /** How many redemptions an invitation allows when its issuer names no count. */
  defaultMaxUses?: number
  /** How many redemptions the most reusable invitation may allow. */
  maxUsesLimit?: number
}

export const Config: z<Config> = z.object({
  defaultLifetimeMs: z.number().step(1).min(60_000).max(MAX_LIFETIME_MS).default(DEFAULT_LIFETIME_MS),
  maxLifetimeMs: z.number().step(1).min(60_000).max(MAX_LIFETIME_MS).default(MAX_LIFETIME_MS),
  defaultMaxUses: z.number().step(1).min(1).max(MAX_USES_LIMIT).default(DEFAULT_MAX_USES),
  maxUsesLimit: z.number().step(1).min(1).max(MAX_USES_LIMIT).default(MAX_USES_LIMIT),
})

/** The bounds one deployment holds invitations to. */
interface Bounds {
  readonly defaultLifetimeMs: number
  readonly maxLifetimeMs: number
  readonly defaultMaxUses: number
  readonly maxUsesLimit: number
}

/**
 * Read the configured bounds.
 * @param config - validated plugin config.
 * @returns the bounds, with every default applied.
 */
export function resolveConfig(config: Config): Bounds {
  return {
    defaultLifetimeMs: config.defaultLifetimeMs ?? DEFAULT_LIFETIME_MS,
    maxLifetimeMs: config.maxLifetimeMs ?? MAX_LIFETIME_MS,
    defaultMaxUses: config.defaultMaxUses ?? DEFAULT_MAX_USES,
    maxUsesLimit: config.maxUsesLimit ?? MAX_USES_LIMIT,
  }
}

/** One refused issue, withdrawal or read, with the reason a surface reports. */
export class InvitationRefusedError extends Error {
  /** Why it was refused. */
  readonly reason: InvitationRefusal

  /**
   * @param reason - why it was refused.
   * @param message - the text a surface shows.
   */
  constructor(reason: InvitationRefusal, message: string) {
    super(message)
    this.name = 'InvitationRefusedError'
    this.reason = reason
  }
}

/**
 * One fresh code: 32 bytes of randomness, base64url.
 *
 * Long enough that guessing one is not a strategy, and URL-safe because it
 * travels as a link.
 * @returns the code to send, which is never stored.
 */
export function newCode(): InvitationCode {
  return brandString<InvitationCode>(randomBytes(32).toString('base64url'))
}

/**
 * The stored form of one code.
 * @param code - the code as its holder presents it.
 * @returns its SHA-256, base64url.
 */
export function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('base64url')
}

/**
 * Whether one invitation can still be redeemed.
 * @param record - the stored invitation.
 * @param now - the instant to judge it at.
 * @returns true while it stands, has uses left, and has not expired.
 */
export function open(record: InvitationRecord, now: Date = new Date()): boolean {
  return record.revokedAt === undefined
    && record.uses < record.maxUses
    && Date.parse(record.expiresAt) > now.getTime()
}

/**
 * What a surface shows for one invitation.
 * @param record - the stored invitation.
 * @param code - the code, on the call that issued it.
 * @returns the view, without the code everywhere else.
 */
function view(record: InvitationRecord, code?: InvitationCode): InvitationView {
  return {
    id: record.id,
    label: record.label,
    role: record.role,
    ...record.organization === undefined ? {} : { organization: record.organization },
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    maxUses: record.maxUses,
    uses: record.uses,
    open: open(record),
    ...code === undefined ? {} : { code },
  }
}

/** The invitations a deployment has issued, and the redemptions they allow. */
export default class Invitations extends Service {
  static inject = ['storageDomain', 'adminAudit', 'managedPeople']
  static readonly Config = Config

  private readonly ready: Promise<Domain<typeof invitationsDomain>>
  private readonly bounds: Bounds

  /**
   * @param ctx - context providing durable storage, the trail and the roster.
   * @param config - validated plugin config.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'invitations')
    this.bounds = resolveConfig(config)
    this.ready = ctx.storageDomain.open(invitationsDomain)
    ctx.effect(() => async () => { await (await this.ready).close() })
  }

  /**
   * Issue one invitation.
   *
   * The code is returned here and nowhere else. The standing it grants is
   * checked against the issuer's own, by the same three rules the roster
   * applies to adding somebody directly: a tenant administrator's standing
   * names an organization, only a platform administrator makes another one,
   * and nobody reaches outside the organization they administer.
   * @param submission - what the administrator filled in.
   * @param by - the standing issuing it.
   * @returns the invitation, with its code.
   * @throws {InvitationRefusedError} when that standing may not issue it, or the bounds refuse it.
   */
  async issue(submission: InvitationSubmission, by: Membership): Promise<InvitationView> {
    this.authorize(submission.role, submission.organization, by)
    const lifetimeMs = submission.lifetimeMs ?? this.bounds.defaultLifetimeMs
    const maxUses = submission.maxUses ?? this.bounds.defaultMaxUses
    if (lifetimeMs < 60_000 || lifetimeMs > this.bounds.maxLifetimeMs
      || maxUses < 1 || maxUses > this.bounds.maxUsesLimit) {
      throw new InvitationRefusedError('out-of-bounds', OUT_OF_BOUNDS)
    }
    const code = newCode()
    const now = new Date()
    const record: InvitationRecord = {
      id: brandString<InvitationId>(randomUUID()),
      codeHash: codeHash(code),
      label: submission.label,
      role: submission.role,
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      issuedBy: by.person,
      issuedIn: by.id,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + lifetimeMs).toISOString(),
      maxUses,
      uses: 0,
    }
    const domain = await this.ready
    await domain.table('invitations').put(record.id, record)
    await this.ctx.adminAudit.record({
      kind: 'invitation',
      subject: record.id,
      subjectName: record.label,
      action: 'added',
      ...record.organization === undefined ? {} : { organization: record.organization },
      changes: [
        { field: 'role', after: record.role },
        { field: 'expiresAt', after: record.expiresAt },
        { field: 'maxUses', after: String(record.maxUses) },
      ],
    }, by)
    return view(record, code)
  }

  /**
   * The invitations one standing administers, newest first.
   * @param by - the standing reading them.
   * @returns their views, without codes.
   */
  async list(by: Membership): Promise<readonly InvitationView[]> {
    const domain = await this.ready
    return [...domain.table('invitations').entries()]
      .map(([, record]) => record)
      .filter(record => administers(by, record.organization))
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))
      .map(record => view(record))
  }

  /**
   * Withdraw one invitation, so a code already sent stops working.
   *
   * The record stays, revoked: the trail of who invited whom is the point of
   * keeping it, and a deleted row would answer nothing when somebody asks how
   * that person got in.
   * @param id - the invitation to withdraw.
   * @param by - the standing withdrawing it.
   * @throws {InvitationRefusedError} when no such invitation exists, or that standing may not withdraw it.
   */
  async revoke(id: InvitationId, by: Membership): Promise<void> {
    const domain = await this.ready
    const existing = domain.table('invitations').get(id)
    if (existing === undefined) throw new InvitationRefusedError('unknown', UNKNOWN)
    if (!administers(by, existing.organization)) throw new InvitationRefusedError('not-permitted', NOT_PERMITTED)
    if (existing.revokedAt !== undefined) return
    const record: InvitationRecord = { ...existing, revokedAt: new Date().toISOString() }
    await domain.table('invitations').put(record.id, record)
    await this.ctx.adminAudit.record({
      kind: 'invitation',
      subject: record.id,
      subjectName: record.label,
      action: 'removed',
      ...record.organization === undefined ? {} : { organization: record.organization },
      changes: [{ field: 'revokedAt', after: record.revokedAt }],
    }, by)
  }

  /**
   * Redeem one code for one verified subject.
   *
   * The use is claimed before the roster is written, so two redemptions
   * racing cannot exceed the count: a claim whose write then fails burns a
   * use, which is the safe direction — an extra member is not recoverable,
   * and a burned use is one more invitation.
   *
   * Every refusal answers undefined, like every other unadmitted subject: a
   * redemption page that distinguished "no such code" from "expired" would
   * tell whoever asked which codes exist.
   *
   * A roster the redemption cannot finish writing is rolled back: a failed
   * binding takes the person it was for with it, so a refused redemption
   * leaves nobody behind, and the failure is raised rather than answered as
   * "not admitted" — the person presenting the code did nothing wrong, and
   * silence would hide a deployment that cannot admit anybody.
   * @param code - the code the person presented.
   * @param subject - the subject their channel verified.
   * @returns the person they now are here, or undefined when the code admits nobody.
   */
  async redeem(code: string, subject: ExternalSubject): Promise<PersonId | undefined> {
    const domain = await this.ready
    const hash = codeHash(code)
    const found = [...domain.table('invitations').entries()]
      .map(([, record]) => record)
      .find(record => record.codeHash === hash)
    if (found === undefined || !open(found)) return undefined
    const issuer = await this.issuerStanding(found)
    if (issuer === undefined) return undefined
    await domain.table('invitations').put(found.id, { ...found, uses: found.uses + 1 })
    const person = await this.ctx.managedPeople.save({
      displayName: subject.displayName ?? subject.address ?? found.label,
      role: found.role,
      ...found.organization === undefined ? {} : { organization: found.organization },
    }, issuer)
    try {
      await this.ctx.managedPeople.bind({
        channel: subject.channel,
        issuer: subject.issuer,
        subject: subject.subject,
        person: person.id,
      }, issuer)
    } catch (refused: unknown) {
      // The roster entry is only worth having with the identity that signs in
      // as it: a person nobody can be is a row an administrator did not ask
      // for and cannot explain. Removing it leaves the burned use as the only
      // trace, which is the same safe direction as a claim whose write fails.
      await this.ctx.managedPeople.remove(person.id, issuer)
      throw refused
    }
    await this.ctx.adminAudit.record({
      kind: 'invitation',
      subject: found.id,
      subjectName: found.label,
      action: 'changed',
      ...found.organization === undefined ? {} : { organization: found.organization },
      changes: [
        { field: 'uses', before: String(found.uses), after: String(found.uses + 1) },
        { field: 'admitted', after: person.id },
      ],
    }, issuer)
    return person.id
  }

  /**
   * Accept one code as somebody the roster already holds, gaining the standing
   * it carries.
   *
   * This is the other half of redemption, and it is deliberately not the same
   * half. A code riding a sign-in still changes nothing for somebody already
   * bound: a link they were forwarded would otherwise add authority to their
   * account during a sign-in they made for another reason. Here the person is
   * signed in and asks for it, which is what makes the grant theirs to
   * accept.
   *
   * It grants no more than the issuing standing could grant directly: the
   * write goes through the roster as that standing, so the roster's own rule
   * decides it — including that changing somebody requires administering
   * every standing they already hold.
   *
   * The use is claimed before the write and released when the roster refuses
   * it, because nothing else was written: unlike a redemption, which leaves a
   * person behind if its binding fails, a refused acceptance leaves the
   * deployment exactly as it was, and burning a use for it would spend an
   * administrator's invitation on an answer of "no".
   * @param code - the code the person presented.
   * @param person - the person accepting it, as the caller's own session names them.
   * @returns the standing they gained, or undefined when the code grants them nothing.
   * @throws when the roster fails for a reason other than refusing the grant.
   */
  async accept(code: string, person: PersonId): Promise<Membership | undefined> {
    const domain = await this.ready
    const hash = codeHash(code)
    const found = [...domain.table('invitations').entries()]
      .map(([, record]) => record)
      .find(record => record.codeHash === hash)
    if (found === undefined || !open(found)) return undefined
    const issuer = await this.issuerStanding(found)
    if (issuer === undefined) return undefined
    await domain.table('invitations').put(found.id, { ...found, uses: found.uses + 1 })
    let granted: Membership
    try {
      const after = await this.ctx.managedPeople.grantStanding({
        person,
        role: found.role,
        ...found.organization === undefined ? {} : { organization: found.organization },
      }, issuer)
      const last = after.standings[after.standings.length - 1]
      /* v8 ignore next -- a grant that returned answers with the standing it wrote; the guard keeps the read total. */
      if (last === undefined) return undefined
      granted = {
        id: brandString<MembershipId>(last.id),
        person,
        role: last.role,
        ...last.organization === undefined ? {} : { organization: last.organization },
      }
    } catch (refused: unknown) {
      await domain.table('invitations').put(found.id, found)
      // A standing this code may not grant this person is an answer, not a
      // failure: the holder did nothing wrong, and telling them which rule
      // refused it would say what the code carries.
      if (refused instanceof PeopleRefusedError) return undefined
      throw refused
    }
    await this.ctx.adminAudit.record({
      kind: 'invitation',
      subject: found.id,
      subjectName: found.label,
      action: 'changed',
      ...found.organization === undefined ? {} : { organization: found.organization },
      changes: [
        { field: 'uses', before: String(found.uses), after: String(found.uses + 1) },
        { field: 'accepted', after: person },
      ],
    }, issuer)
    return granted
  }

  /**
   * The standing one invitation was issued in, if it still holds that authority.
   *
   * An invitation carries no more than its issuer still has: a code issued by
   * an administrator who was removed, demoted, or moved to another
   * organization admits nobody.
   * @param record - the stored invitation.
   * @returns the issuing standing, or undefined when it no longer authorizes this invitation.
   */
  private async issuerStanding(record: InvitationRecord): Promise<Membership | undefined> {
    const standing = await this.ctx.managedPeople.membership(record.issuedIn)
    if (standing === undefined || standing.person !== record.issuedBy) return undefined
    if (record.role === 'platform-administrator' && standing.role !== 'platform-administrator') return undefined
    return administers(standing, record.organization) ? standing : undefined
  }

  /**
   * Whether this standing may issue an invitation to that role and organization.
   * @param role - the role a redemption would grant.
   * @param organization - the organization it would be in.
   * @param by - the standing issuing it.
   * @throws {InvitationRefusedError} when it may not.
   */
  private authorize(role: Role, organization: string | undefined, by: Membership): void {
    if (role === 'tenant-administrator' && organization === undefined) {
      throw new InvitationRefusedError('organization-required', ORGANIZATION_REQUIRED)
    }
    if (role === 'platform-administrator' && by.role !== 'platform-administrator') {
      throw new InvitationRefusedError('not-permitted', NOT_PERMITTED)
    }
    if (!administers(by, organization)) throw new InvitationRefusedError('not-permitted', NOT_PERMITTED)
  }
}

/** The membership identity type, re-exported for a consumer that stores one. */
export type { MembershipId }
