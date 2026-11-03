/**
 * The people a deployment's administrators maintain at runtime, and the
 * directory identities admitted as them.
 *
 * A roster written into composition is the people decided when the
 * installation was assembled. That is right for the first of them — an empty
 * system has no administrator to add the first administrator — and wrong for
 * every one after: adding a colleague should not be an edit to a file on the
 * server followed by a restart.
 *
 * So both halves coexist, and the written half wins. Composition names the
 * people the operator stands behind, and this service holds the ones an
 * administrator added since; a written person cannot be changed or removed
 * here, because the next boot would bring them back and the surface would
 * have lied. The same holds for an admission binding.
 *
 * @module @deepseek-ai/dsh-managed-people
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { fieldChanges } from '@deepseek-ai/dsh-admin-audit'
import type { AuditSubmission } from '@deepseek-ai/dsh-admin-audit'
import { administers } from '@deepseek-ai/dsh-people'
import type { Membership, MembershipId, Person, PersonId, Role } from '@deepseek-ai/dsh-people'
import type {} from '@deepseek-ai/dsh-sign-in-channels'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { managedPeopleDomain } from './storage.ts'
import type {
  BindingRecord, BindingSubmission, BindingView, DeclaredPerson,
  PersonKind, PersonRecord, PersonSubmission, PersonView,
} from './types.ts'

export type * from './types.ts'
export { managedPeopleDomain, personSchema, bindingSchema } from './storage.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The people and bindings administrators maintain at runtime; absent where a deployment manages none. */
    managedPeople: ManagedPeople
  }
}

/** Message an unauthorized administrator attempt is refused with. */
export const NOT_PERMITTED = 'managed-people: this standing may not make that change'

/** Message a change to a composition-written person or binding is refused with. */
export const WRITTEN = 'managed-people: the installation\'s configuration owns that entry'

/** Message a binding naming nobody is refused with. */
export const UNKNOWN_PERSON = 'managed-people: no such person'

/** Message a second binding of one directory identity is refused with. */
export const ALREADY_BOUND = 'managed-people: that directory identity is already admitted'

/** Message an attempt to admit a directory identity as a bot is refused with. */
export const NOT_A_PERSON = 'managed-people: a bot does not sign in'

/** Message a tenant administrator without an organization is refused with. */
export const ORGANIZATION_REQUIRED = 'managed-people: a tenant administrator names the organization they administer'

/**
 * Why one directory change was refused.
 *
 * A closed set rather than a message to read: the surface reporting it marks
 * one field, disables one row, or says the standing is wrong, and deciding
 * which by matching prose would break the moment the prose changed.
 */
export type PeopleRefusal =
  | 'not-permitted'
  | 'written'
  | 'unknown-person'
  | 'already-bound'
  | 'organization-required'
  | 'not-a-person'

/** A directory change this service refused, carrying the reason it refused. */
export class PeopleRefusedError extends Error {
  /** Which rule refused it. */
  readonly reason: PeopleRefusal

  /**
   * @param reason - which rule refused it.
   * @param message - what went wrong, in words an administrator can act on.
   */
  constructor(reason: PeopleRefusal, message: string) {
    super(message)
    this.name = 'PeopleRefusedError'
    this.reason = reason
  }
}

/**
 * The key one admission binding is found by.
 *
 * All three parts, because each can repeat on its own: a subject is unique
 * only within its directory, and one directory reached through two channels
 * is two trust paths even though it is one directory.
 * @param channel - the channel that authenticated them.
 * @param issuer - the directory that channel reported.
 * @param subject - their identity within it.
 * @returns the lookup key.
 */
export function bindingKey(channel: string, issuer: string, subject: string): string {
  return JSON.stringify([channel, issuer, subject])
}

/**
 * The standing one stored person holds.
 *
 * Derived from their identity and nothing else, so an administrator changing
 * someone's role does not change the standing a signed-in session already
 * names: a membership id that moved would leave that session acting with no
 * standing at all.
 * @param id - the person's identity.
 * @returns their membership identity.
 */
export function standingOf(id: PersonId): MembershipId {
  return brandString<MembershipId>(`${id}:standing`)
}

/** The people and bindings this deployment stores, and the written ones they may not shadow. */
export class ManagedPeople extends Service {
  static inject = ['storageDomain', 'adminAudit']

  private readonly ready: Promise<Domain<typeof managedPeopleDomain>>

  private readonly written = new Map<PersonId, DeclaredPerson>()

  private readonly writtenBindings = new Map<string, BindingSubmission>()

  /**
   * @param ctx - context providing durable storage.
   */
  constructor(ctx: Context) {
    super(ctx, 'managedPeople')
    this.ready = ctx.storageDomain.open(managedPeopleDomain)
    ctx.effect(() => async () => { await (await this.ready).close() })
  }

  /**
   * Declare one person another owner holds.
   *
   * The provider that read the roster registers what composition wrote, and
   * the bot roster registers its own entries, so this service can refuse to
   * shadow either and a surface can show who holds them. A declared entry is
   * answered by every lookup and is never stored here.
   * @param entry - the person, the standing they hold, and which kind they are.
   * @returns the disposer that withdraws them.
   */
  declarePerson(entry: DeclaredPerson): () => void {
    this.written.set(entry.person.id, entry)
    return () => { this.written.delete(entry.person.id) }
  }

  /**
   * Declare one admission binding composition wrote.
   * @param entry - the directory identity and who it signs in as.
   * @returns the disposer that withdraws it.
   */
  declareBinding(entry: BindingSubmission): () => void {
    const key = bindingKey(entry.channel, entry.issuer, entry.subject)
    this.writtenBindings.set(key, entry)
    return () => { this.writtenBindings.delete(key) }
  }

  /**
   * One person by identity, written or stored.
   * @param id - the person's stable identity.
   * @returns the person, or undefined when neither half names them.
   */
  async person(id: PersonId): Promise<Person | undefined> {
    const entry = this.written.get(id)
    if (entry !== undefined) return entry.person
    const record = (await this.ready).table('people').get(id)
    return record === undefined ? undefined : Object.freeze({ id: record.id, displayName: record.displayName })
  }

  /**
   * One standing by identity, written or stored.
   * @param id - the standing's stable identity.
   * @returns the standing, or undefined when neither half holds it.
   */
  async membership(id: MembershipId): Promise<Membership | undefined> {
    for (const entry of this.written.values()) if (entry.membership.id === id) return entry.membership
    for (const [, record] of (await this.ready).table('people').entries()) {
      if (standingOf(record.id) === id) return membershipOf(record)
    }
    return undefined
  }

  /**
   * Every standing one person holds.
   * @param person - the person whose standings to list.
   * @returns their standings; one, or none when nobody holds that identity.
   */
  async memberships(person: PersonId): Promise<readonly Membership[]> {
    const entry = this.written.get(person)
    if (entry !== undefined) return [entry.membership]
    const record = (await this.ready).table('people').get(person)
    return record === undefined ? [] : [membershipOf(record)]
  }

  /**
   * The person one admitted directory identity signs in as.
   * @param key - the binding's lookup key, from {@link bindingKey}.
   * @returns that person, or undefined when neither half admits the identity.
   */
  async admit(key: string): Promise<PersonId | undefined> {
    const written = this.writtenBindings.get(key)
    if (written !== undefined) return written.person
    return (await this.ready).table('bindings').get(key)?.person
  }

  /**
   * The people one standing administers, written and stored alike.
   * @param by - the standing asking.
   * @returns the people it administers, written ones first, then oldest stored first.
   */
  async list(by: Membership): Promise<readonly PersonView[]> {
    const domain = await this.ready
    const bindings = [...domain.table('bindings').entries()].map(([, record]) => record)
    const views: PersonView[] = []
    for (const entry of this.written.values()) {
      if (!administers(by, entry.membership.organization)) continue
      views.push(this.view(entry.person.id, entry.membership, entry.person.displayName, entry.kind ?? 'person', true, bindings))
    }
    for (const [, record] of domain.table('people').entries()) {
      if (!administers(by, record.organization)) continue
      views.push(this.view(record.id, membershipOf(record), record.displayName, 'person', false, bindings))
    }
    return views
  }

  /**
   * Add one person, or change one this service holds.
   * @param submission - what the administrator filled in.
   * @param by - the standing making the change.
   * @returns the person as they now read.
   * @throws {PeopleRefusedError} when the standing may not make the change, or composition owns the person.
   */
  async save(submission: PersonSubmission, by: Membership): Promise<PersonView> {
    this.authorize(submission.role, submission.organization, by)
    const domain = await this.ready
    const existing = submission.id === undefined ? undefined : domain.table('people').get(submission.id)
    if (submission.id !== undefined && this.written.has(submission.id)) {
      throw new PeopleRefusedError('written', WRITTEN)
    }
    // A change is authorized against what is stored as well as against what
    // was submitted: otherwise one tenant's administrator could take another
    // tenant's person by naming their id with their own organization.
    if (existing !== undefined) this.authorize(existing.role, existing.organization, by)
    const record: PersonRecord = {
      id: existing?.id ?? brandString<PersonId>(randomUUID()),
      displayName: submission.displayName,
      role: submission.role,
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      addedBy: existing?.addedBy ?? by.person,
    }
    await domain.table('people').put(record.id, record)
    await this.audit({
      kind: 'person',
      subject: record.id,
      subjectName: record.displayName,
      action: existing === undefined ? 'added' : 'changed',
      ...record.organization === undefined ? {} : { organization: record.organization },
      changes: fieldChanges(existing === undefined ? undefined : personFields(existing), personFields(record)),
    }, by)
    const bindings = [...domain.table('bindings').entries()].map(([, row]) => row)
    return this.view(record.id, membershipOf(record), record.displayName, 'person', false, bindings)
  }

  /**
   * Remove one person this service holds, and every binding that admitted them.
   *
   * Their identity is not reused, so the conversations they opened stay
   * attributed to somebody who no longer signs in rather than to whoever is
   * added next.
   * @param id - the person to remove.
   * @param by - the standing making the change.
   * @throws {PeopleRefusedError} when the standing may not remove them, or composition owns them.
   */
  async remove(id: PersonId, by: Membership): Promise<void> {
    if (this.written.has(id)) throw new PeopleRefusedError('written', WRITTEN)
    const domain = await this.ready
    const existing = domain.table('people').get(id)
    if (existing === undefined) return
    this.authorize(existing.role, existing.organization, by)
    for (const [key, record] of domain.table('bindings').entries()) {
      if (record.person !== id) continue
      await domain.table('bindings').delete(key)
      await this.audit({
        kind: 'binding',
        subject: key,
        subjectName: identityName(record),
        action: 'removed',
        ...existing.organization === undefined ? {} : { organization: existing.organization },
        changes: fieldChanges(bindingFields(record), undefined),
      }, by)
    }
    await domain.table('people').delete(id)
    await this.audit({
      kind: 'person',
      subject: id,
      subjectName: existing.displayName,
      action: 'removed',
      ...existing.organization === undefined ? {} : { organization: existing.organization },
      changes: fieldChanges(personFields(existing), undefined),
    }, by)
  }

  /**
   * Admit one directory identity as one person.
   * @param submission - the identity and who it signs in as.
   * @param by - the standing making the change.
   * @returns the binding as a surface shows it.
   * @throws {PeopleRefusedError} when the standing may not make the change, nobody holds that identity, or it is already admitted.
   */
  async bind(submission: BindingSubmission, by: Membership): Promise<BindingView> {
    const standing = await this.standingFor(submission.person)
    if (standing === undefined) throw new PeopleRefusedError('unknown-person', UNKNOWN_PERSON)
    // A bot holds a standing and owns conversations, and no directory can
    // authenticate one. Admitting an identity as a bot would hand a human
    // subject the bot's standing under the bot's name.
    if (this.written.get(submission.person)?.kind === 'bot') {
      throw new PeopleRefusedError('not-a-person', NOT_A_PERSON)
    }
    if (!administers(by, standing.organization)) throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    await this.authorizeChannel(submission.channel, by)
    const key = bindingKey(submission.channel, submission.issuer, submission.subject)
    if (this.writtenBindings.has(key)) throw new PeopleRefusedError('written', WRITTEN)
    const domain = await this.ready
    // One identity, one person: a second binding would decide who somebody
    // signs in as by whichever row was read first.
    if (domain.table('bindings').get(key) !== undefined) {
      throw new PeopleRefusedError('already-bound', ALREADY_BOUND)
    }
    const record: BindingRecord = {
      channel: submission.channel,
      issuer: submission.issuer,
      subject: submission.subject,
      person: submission.person,
      boundAt: new Date().toISOString(),
      boundBy: by.person,
    }
    await domain.table('bindings').put(key, record)
    await this.audit({
      kind: 'binding',
      subject: key,
      subjectName: identityName(record),
      action: 'added',
      ...standing.organization === undefined ? {} : { organization: standing.organization },
      changes: fieldChanges(undefined, bindingFields(record)),
    }, by)
    return { channel: record.channel, issuer: record.issuer, subject: record.subject, written: false }
  }

  /**
   * Stop admitting one directory identity.
   * @param submission - the identity to stop admitting; its person is not read.
   * @param by - the standing making the change.
   * @throws {PeopleRefusedError} when the standing may not make the change, or composition owns the binding.
   */
  async unbind(submission: Omit<BindingSubmission, 'person'>, by: Membership): Promise<void> {
    const key = bindingKey(submission.channel, submission.issuer, submission.subject)
    if (this.writtenBindings.has(key)) throw new PeopleRefusedError('written', WRITTEN)
    const domain = await this.ready
    const existing = domain.table('bindings').get(key)
    if (existing === undefined) return
    const standing = await this.standingFor(existing.person)
    if (standing !== undefined && !administers(by, standing.organization)) {
      throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    }
    await domain.table('bindings').delete(key)
    await this.audit({
      kind: 'binding',
      subject: key,
      subjectName: identityName(existing),
      action: 'removed',
      ...standing?.organization === undefined ? {} : { organization: standing.organization },
      changes: fieldChanges(bindingFields(existing), undefined),
    }, by)
  }

  /**
   * Record one change in the trail, unless nothing changed.
   *
   * A submission that altered no field is an administrator pressing Save
   * without an edit, and an entry for it would be an entry an auditor has to
   * read past. An addition and a removal are always recorded, because the
   * record existing or not is itself the change.
   */
  private async audit(submission: AuditSubmission, by: Membership): Promise<void> {
    if (submission.action === 'changed' && submission.changes.length === 0) return
    await this.ctx.adminAudit.record(submission, by)
  }

  /** The organization and role one person holds, written or stored. */
  private async standingFor(person: PersonId): Promise<Membership | undefined> {
    const [standing] = await this.memberships(person)
    return standing
  }

  /**
   * Whether this standing may put somebody in that role and organization.
   *
   * Granting a role is granting what it may do, so a tenant administrator
   * cannot make a platform administrator: that standing administers every
   * organization, including the ones this one does not.
   */
  private authorize(role: Role, organization: string | undefined, by: Membership): void {
    if (role === 'tenant-administrator' && organization === undefined) {
      throw new PeopleRefusedError('organization-required', ORGANIZATION_REQUIRED)
    }
    if (role === 'platform-administrator' && by.role !== 'platform-administrator') {
      throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    }
    if (!administers(by, organization)) throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
  }

  /**
   * Whether this standing may admit somebody through that channel.
   *
   * Checked against the configured channels when a deployment stores them,
   * because a binding on another organization's directory lets that
   * organization's people sign in here. A deployment whose channels come
   * from composition stores none, and the binding is authorized by the
   * person it names alone.
   */
  private async authorizeChannel(channel: string, by: Membership): Promise<void> {
    const channels = this.ctx.get('signInChannels')
    if (channels === undefined) return
    const permitted = await channels.list(by)
    if (!permitted.some(candidate => candidate.id === channel)) {
      throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    }
  }

  /** One person as a surface shows them, with the identities that sign in as them. */
  private view(
    id: PersonId,
    standing: Membership,
    displayName: string,
    kind: PersonKind,
    written: boolean,
    stored: readonly BindingRecord[],
  ): PersonView {
    const bindings: BindingView[] = []
    for (const [, entry] of this.writtenBindings) {
      if (entry.person !== id) continue
      bindings.push({ channel: entry.channel, issuer: entry.issuer, subject: entry.subject, written: true })
    }
    for (const record of stored) {
      if (record.person !== id) continue
      bindings.push({ channel: record.channel, issuer: record.issuer, subject: record.subject, written: false })
    }
    return {
      id,
      kind,
      displayName,
      role: standing.role,
      ...standing.organization === undefined ? {} : { organization: standing.organization },
      written,
      bindings,
    }
  }
}

/** The standing one stored person holds, as the directory reports it. */
function membershipOf(record: PersonRecord): Membership {
  return Object.freeze({
    id: standingOf(record.id),
    person: record.id,
    role: record.role,
    ...record.organization === undefined ? {} : { organization: record.organization },
  })
}

/** One person's audited fields, as an auditor would read them out. */
function personFields(record: PersonRecord): Record<string, string> {
  return {
    displayName: record.displayName,
    role: record.role,
    ...record.organization === undefined ? {} : { organization: record.organization },
  }
}

/** One binding's audited field: who the identity signs in as. */
function bindingFields(record: BindingRecord): Record<string, string> {
  return { person: record.person }
}

/** One directory identity in the words an auditor reads, rather than as a lookup key. */
function identityName(record: BindingRecord): string {
  return `${record.channel}:${record.issuer}:${record.subject}`
}

export default ManagedPeople
