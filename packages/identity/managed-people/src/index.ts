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
// Type-only: the registry of channels this deployment serves, read optionally
// so a composition-written channel can be bound on.
import type {} from '@deepseek-ai/dsh-sign-in'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { managedPeopleDomain } from './storage.ts'
import type {
  BindingRecord, BindingSubmission, BindingView, DeclaredPerson,
  PersonKind, PersonRecord, PersonSubmission, PersonView, StandingRecord,
  StandingSubmission, StandingView,
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

/** Message a second grant of one standing is refused with. */
export const ALREADY_HELD = 'managed-people: that person already holds that standing'

/** Message revoking somebody's only standing is refused with. */
export const LAST_STANDING = 'managed-people: that is their only standing; remove the person instead'

/** Message a revocation naming no stored standing is refused with. */
export const UNKNOWN_STANDING = 'managed-people: no such standing'

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
  | 'already-held'
  | 'last-standing'
  | 'unknown-standing'

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

/**
 * The standings one stored record holds, in either generation.
 *
 * A first-generation record wrote one `role` and no list; it folds into a
 * one-entry list whose identity is the one that generation derived, so a
 * session signed in then, and every invitation issued in that standing, still
 * name a standing this deployment holds.
 * @param record - the stored person, as either generation wrote them.
 * @returns their standings, oldest first; never empty.
 */
export function standingsOf(record: PersonRecord): readonly StandingRecord[] {
  if (record.standings !== undefined) return record.standings
  /* v8 ignore next 3 -- unreachable: the schema admits a record with neither form, and nothing writes one. */
  if (record.role === undefined) return []
  return [{
    id: standingOf(record.id),
    role: record.role,
    ...record.organization === undefined ? {} : { organization: record.organization },
    addedAt: record.addedAt,
    addedBy: record.addedBy,
  }]
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
    for (const entry of this.written.values()) {
      const found = entry.memberships.find(candidate => candidate.id === id)
      if (found !== undefined) return found
    }
    for (const [, record] of (await this.ready).table('people').entries()) {
      const found = standingsOf(record).find(standing => standing.id === id)
      if (found !== undefined) return membershipOf(record.id, found)
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
    if (entry !== undefined) return entry.memberships
    const record = (await this.ready).table('people').get(person)
    return record === undefined ? [] : standingsOf(record).map(standing => membershipOf(person, standing))
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
      // Only the standings this caller administers: a tenant administrator
      // reading that somebody also administers another organization would be
      // reading past their own.
      const shown = entry.memberships.filter(standing => administers(by, standing.organization))
      if (shown.length === 0) continue
      views.push(this.view(entry.person.id, shown, entry.person.displayName, entry.kind ?? 'person', true, bindings))
    }
    for (const [, record] of domain.table('people').entries()) {
      const shown = standingsOf(record)
        .filter(standing => administers(by, standing.organization))
        .map(standing => membershipOf(record.id, standing))
      if (shown.length === 0) continue
      views.push(this.view(record.id, shown, record.displayName, 'person', false, bindings))
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
    // tenant's person by naming their id with their own organization. Every
    // standing, not the first: somebody who also belongs elsewhere is not
    // this caller's to rename.
    const held = existing === undefined ? [] : standingsOf(existing)
    for (const standing of held) this.authorize(standing.role, standing.organization, by)
    const [primary, ...rest] = held
    const id = existing?.id ?? brandString<PersonId>(randomUUID())
    const record: PersonRecord = {
      id,
      displayName: submission.displayName,
      // The submission carries one standing, which is this person's first;
      // the others are granted and revoked on their own and are left alone.
      // Its identity is the one the first generation derived, so a session
      // signed in before this change still names a standing they hold.
      standings: [{
        id: primary?.id ?? standingOf(id),
        role: submission.role,
        ...submission.organization === undefined ? {} : { organization: submission.organization },
        addedAt: primary?.addedAt ?? new Date().toISOString(),
        addedBy: primary?.addedBy ?? by.person,
      }, ...rest],
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      addedBy: existing?.addedBy ?? by.person,
    }
    await domain.table('people').put(record.id, record)
    await this.audit({
      kind: 'person',
      subject: record.id,
      subjectName: record.displayName,
      action: existing === undefined ? 'added' : 'changed',
      // The organization of the standing this change wrote: a record of this
      // generation carries no organization of its own, and an entry filed
      // under none is one that organization's administrator cannot read.
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      changes: fieldChanges(existing === undefined ? undefined : personFields(existing), personFields(record)),
    }, by)
    const bindings = [...domain.table('bindings').entries()].map(([, row]) => row)
    return this.view(
      record.id,
      standingsOf(record).map(standing => membershipOf(record.id, standing)),
      record.displayName,
      'person',
      false,
      bindings,
    )
  }

  /**
   * Grant one further standing to a person this service holds.
   *
   * Beside `save`, which writes the one standing most people hold, because a
   * second standing is a different decision: it says this person also belongs
   * somewhere else, and it leaves everything they already hold alone.
   * @param submission - who holds it, and what it may do where.
   * @param by - the standing making the change.
   * @returns the person as they now read.
   * @throws {PeopleRefusedError} when the standing may not grant it, composition
   * owns the person, nobody holds that identity, or they hold it already.
   */
  async grantStanding(submission: StandingSubmission, by: Membership): Promise<PersonView> {
    this.authorize(submission.role, submission.organization, by)
    if (this.written.has(submission.person)) throw new PeopleRefusedError('written', WRITTEN)
    const domain = await this.ready
    const existing = domain.table('people').get(submission.person)
    if (existing === undefined) throw new PeopleRefusedError('unknown-person', UNKNOWN_PERSON)
    const held = standingsOf(existing)
    // Every standing they already hold: attaching one organization's standing
    // to another organization's person is how somebody would reach past their
    // own.
    for (const standing of held) this.authorize(standing.role, standing.organization, by)
    if (held.some(standing => standing.role === submission.role && standing.organization === submission.organization)) {
      throw new PeopleRefusedError('already-held', ALREADY_HELD)
    }
    const granted: StandingRecord = {
      id: brandString<MembershipId>(`${submission.person}:${randomUUID()}`),
      role: submission.role,
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      addedAt: new Date().toISOString(),
      addedBy: by.person,
    }
    const record: PersonRecord = { ...stripLegacy(existing), standings: [...held, granted] }
    await domain.table('people').put(record.id, record)
    await this.audit({
      kind: 'person',
      subject: record.id,
      subjectName: record.displayName,
      action: 'changed',
      ...granted.organization === undefined ? {} : { organization: granted.organization },
      changes: fieldChanges(personFields(existing), personFields(record)),
    }, by)
    const bindings = [...domain.table('bindings').entries()].map(([, row]) => row)
    return this.view(
      record.id,
      standingsOf(record).map(standing => membershipOf(record.id, standing)),
      record.displayName,
      'person',
      false,
      bindings,
    )
  }

  /**
   * Revoke one standing a person holds.
   *
   * The last one is refused: a person holding none could act in no context at
   * all, and a roster entry nobody can be is not what an administrator meant
   * — removing the person is {@link remove}, and it says so.
   * @param standing - the standing to revoke.
   * @param by - the standing making the change.
   * @throws {PeopleRefusedError} when the standing may not revoke it, composition
   * owns the person, no stored person holds it, or it is their last one.
   */
  async revokeStanding(standing: MembershipId, by: Membership): Promise<void> {
    const domain = await this.ready
    for (const [, record] of domain.table('people').entries()) {
      const held = standingsOf(record)
      const found = held.find(candidate => candidate.id === standing)
      if (found === undefined) continue
      this.authorize(found.role, found.organization, by)
      if (held.length === 1) throw new PeopleRefusedError('last-standing', LAST_STANDING)
      const next: PersonRecord = {
        ...stripLegacy(record),
        standings: held.filter(candidate => candidate.id !== standing),
      }
      await domain.table('people').put(next.id, next)
      await this.audit({
        kind: 'person',
        subject: next.id,
        subjectName: next.displayName,
        action: 'changed',
        ...found.organization === undefined ? {} : { organization: found.organization },
        changes: fieldChanges(personFields(record), personFields(next)),
      }, by)
      return
    }
    throw new PeopleRefusedError('unknown-standing', UNKNOWN_STANDING)
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
    // Every standing: a person who also belongs to another organization is
    // not this caller's to delete.
    const held = standingsOf(existing)
    for (const standing of held) this.authorize(standing.role, standing.organization, by)
    // Filed under the organization of their first standing, which is where an
    // administrator of it goes looking for what happened to them.
    const filed = held[0]?.organization
    for (const [key, record] of domain.table('bindings').entries()) {
      if (record.person !== id) continue
      await domain.table('bindings').delete(key)
      await this.audit({
        kind: 'binding',
        subject: key,
        subjectName: identityName(record),
        action: 'removed',
        ...filed === undefined ? {} : { organization: filed },
        changes: fieldChanges(bindingFields(record), undefined),
      }, by)
    }
    await domain.table('people').delete(id)
    await this.audit({
      kind: 'person',
      subject: id,
      subjectName: existing.displayName,
      action: 'removed',
      ...filed === undefined ? {} : { organization: filed },
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
    const held = await this.memberships(submission.person)
    const [standing] = held
    if (standing === undefined) throw new PeopleRefusedError('unknown-person', UNKNOWN_PERSON)
    // A bot holds a standing and owns conversations, and no directory can
    // authenticate one. Admitting an identity as a bot would hand a human
    // subject the bot's standing under the bot's name.
    if (this.written.get(submission.person)?.kind === 'bot') {
      throw new PeopleRefusedError('not-a-person', NOT_A_PERSON)
    }
    // Every standing they hold: a binding admits one identity as the whole
    // person, who then acts for each of them, so an administrator of one
    // organization cannot admit somebody who also belongs to another.
    for (const candidate of held) {
      if (!administers(by, candidate.organization)) throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    }
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
    // Every standing, for the same reason the binding needed all of them.
    const held = await this.memberships(existing.person)
    for (const candidate of held) {
      if (!administers(by, candidate.organization)) throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
    }
    const [standing] = held
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
    if (permitted.some(candidate => candidate.id === channel)) return
    // A channel composition wrote is not in that store and never can be: the
    // installation's own files name it, so no standing configured it and
    // none can change it. It serves the whole deployment, and who may be
    // admitted through it has already been decided by the person check above.
    if (this.ctx.get('signIn')?.available().some(candidate => candidate.id === channel) === true) return
    throw new PeopleRefusedError('not-permitted', NOT_PERMITTED)
  }

  /**
   * One person as a surface shows them, with the identities that sign in as
   * them.
   *
   * `role` and `organization` repeat the first of the standings shown, for
   * the surfaces that still render one standing per person; anything deciding
   * what a person may do reads the list.
   */
  private view(
    id: PersonId,
    standings: readonly Membership[],
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
    const [first] = standings
    /* v8 ignore next 2 -- every caller filters to at least one standing; a person holding none is not shown at all. */
    if (first === undefined) throw new Error('managed-people: a person view needs at least one standing')
    return {
      id,
      kind,
      displayName,
      standings: standings.map((standing): StandingView => ({
        id: standing.id,
        role: standing.role,
        ...standing.organization === undefined ? {} : { organization: standing.organization },
      })),
      role: first.role,
      ...first.organization === undefined ? {} : { organization: first.organization },
      written,
      bindings,
    }
  }
}

/**
 * One stored person without the first generation's fields.
 *
 * A record this generation writes carries `standings` and neither `role` nor
 * `organization`: leaving them beside the list would be two answers to one
 * question, and the schema admits either form rather than both.
 * @param record - the stored person, as either generation wrote them.
 * @returns the same person, ready to be written with a list.
 */
function stripLegacy(record: PersonRecord): PersonRecord {
  const { role: _role, organization: _organization, ...rest } = record
  return rest
}

/**
 * One stored standing, as the directory reports it.
 * @param person - the person who holds it.
 * @param standing - the stored standing.
 * @returns the standing a lookup answers with.
 */
function membershipOf(person: PersonId, standing: StandingRecord): Membership {
  return Object.freeze({
    id: standing.id,
    person,
    role: standing.role,
    ...standing.organization === undefined ? {} : { organization: standing.organization },
  })
}

/** One person's audited fields, as an auditor would read them out. */
function personFields(record: PersonRecord): Record<string, string> {
  const standings = standingsOf(record)
  return {
    displayName: record.displayName,
    // Every standing, in one field: an auditor reading "member of acme" where
    // somebody also administers the platform would be reading half the change.
    standings: standings.map(standing => standingName(standing)).join(', '),
  }
}

/**
 * One standing in the words an auditor reads.
 * @param standing - the stored standing.
 * @returns its role, with the organization it is in when it names one.
 */
function standingName(standing: StandingRecord): string {
  return standing.organization === undefined ? standing.role : `${standing.role}@${standing.organization}`
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
