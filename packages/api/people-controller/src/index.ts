/**
 * Host Remote owner of the `people` namespace: administrators maintain who
 * may use this deployment and which directory identity each of them is.
 *
 * Who may change what is not decided here. The managed directory holds those
 * rules — a standing administers its own organization, and cannot grant a
 * standing it does not hold — and this namespace hands it the caller's
 * standing and reports what it answered. A second rule written here would be
 * one to keep in step with the first, and the one a direct caller bypasses.
 *
 * @module @deepseek-ai/dsh-api-people-controller
 */

import { Context } from '@deepseek-ai/cordis'
import { PeopleRefusedError } from '@deepseek-ai/dsh-managed-people'
import type { BindingSubmission, PeopleRefusal, PersonSubmission, PersonView } from '@deepseek-ai/dsh-managed-people'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Membership, PersonId } from '@deepseek-ai/dsh-people'
import { callingStanding } from '@deepseek-ai/dsh-request-principal'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { assertNever } from '@deepseek-ai/dsh-util-values'
import type { BindingInput, IdentityInput, PersonInput, PersonRowView } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `people` Remote namespace. */
    peopleController: PeopleController
  }
}

/** Host service backing the generated `ctx.remote.people` namespace. */
export default class PeopleController extends TypertRemoteService {
  /**
   * Register the people namespace.
   * @param ctx - Host context where the managed directory, the directory and the principal are mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'peopleController', { namespace: 'people', requires: 'tenant-administrator' })
  }

  /**
   * The people the calling standing may change.
   *
   * People only. The roster also answers the deployment's bots, because a
   * bot owns the conversations it opens, and this surface is about who signs
   * in: a bot listed here would be a row an administrator could neither
   * change nor admit an identity as.
   * @returns the people it administers, written ones first.
   * @throws {RemoteError} `people/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment maintains no directory.
   */
  @Remote
  async list(): Promise<readonly PersonRowView[]> {
    const directory = this.managed()
    const roster = await directory.list(await this.calling())
    return roster.filter(entry => entry.kind === 'person').map(view)
  }

  /**
   * Add one person, or change one this deployment maintains.
   * @param input - what the administrator filled in.
   * @returns the person as the deployment now reads them.
   * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/incomplete`,
   * `people/no-standing`, or `gateway/internal`.
   */
  @Remote
  async save(input: PersonInput): Promise<PersonRowView> {
    const directory = this.managed()
    const by = await this.calling()
    const submission: PersonSubmission = {
      ...input.id === undefined ? {} : { id: brandString<PersonId>(input.id) },
      displayName: input.displayName,
      role: input.role,
      ...input.organization === undefined ? {} : { organization: input.organization },
    }
    try {
      return view(await directory.save(submission, by))
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Remove one person, and every identity admitted as them.
   * @param id - the person to remove.
   * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/no-standing`,
   * or `gateway/internal`.
   */
  @Remote
  async remove(id: string): Promise<void> {
    const directory = this.managed()
    const by = await this.calling()
    try {
      await directory.remove(brandString<PersonId>(id), by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Admit one directory identity as one person.
   * @param input - the identity and who it signs in as.
   * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/unknown-person`,
   * `people/already-bound`, `people/not-a-person`, `people/no-standing`, or `gateway/internal`.
   */
  @Remote
  async bind(input: BindingInput): Promise<void> {
    const directory = this.managed()
    const by = await this.calling()
    const submission: BindingSubmission = {
      channel: input.channel,
      issuer: input.issuer,
      subject: input.subject,
      person: brandString<PersonId>(input.person),
    }
    try {
      await directory.bind(submission, by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Stop admitting one directory identity.
   * @param input - the identity to stop admitting.
   * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/no-standing`,
   * or `gateway/internal`.
   */
  @Remote
  async unbind(input: IdentityInput): Promise<void> {
    const directory = this.managed()
    const by = await this.calling()
    try {
      await directory.unbind({ channel: input.channel, issuer: input.issuer, subject: input.subject }, by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /** The managed directory, where this deployment maintains one. */
  private managed(): Context['managedPeople'] {
    const directory = this.ctx.get('managedPeople')
    if (directory === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment maintains no directory of its own', {
        endpoint: 'people',
      })
    }
    return directory
  }

  /**
   * The standing this call acts in.
   *
   * Resolved rather than assumed: where a deployment mounts no authorization
   * rule, every call reaches here, and a change to who may use the system
   * made on no standing would be one nobody is answerable for.
   */
  private async calling(): Promise<Membership> {
    const held = await callingStanding(this.ctx)
    if (held === undefined) throw new RemoteError('people/no-standing', 'this call acts in no standing', {})
    return held
  }
}

/**
 * Project one person onto their wire view.
 * @param person - the person as the directory holds them.
 * @returns the view this namespace answers with.
 */
function view(person: PersonView): PersonRowView {
  return {
    id: person.id,
    displayName: person.displayName,
    role: person.role,
    ...person.organization === undefined ? {} : { organization: person.organization },
    written: person.written,
    bindings: person.bindings.map(binding => ({
      channel: binding.channel,
      issuer: binding.issuer,
      subject: binding.subject,
      written: binding.written,
    })),
  }
}

/**
 * One refusal from the directory, as the wire reports it; anything else as itself.
 * @param refused - what the directory threw.
 * @returns the error to throw.
 */
function refusal(refused: unknown): unknown {
  if (!(refused instanceof PeopleRefusedError)) return refused
  return reported(refused.reason, refused.message)
}

/**
 * The failure one refusal is reported as.
 * @param reason - which rule refused the change.
 * @param message - the directory's own words.
 * @returns the error to throw.
 */
function reported(reason: PeopleRefusal, message: string): RemoteError {
  switch (reason) {
    case 'not-permitted': return new RemoteError('people/not-permitted', message, {})
    case 'written': return new RemoteError('people/written', message, {})
    case 'unknown-person': return new RemoteError('people/unknown-person', message, {})
    case 'already-bound': return new RemoteError('people/already-bound', message, {})
    case 'not-a-person': return new RemoteError('people/not-a-person', message, {})
    case 'organization-required': return new RemoteError('people/incomplete', message, { fields: ['organization'] })
    /* v8 ignore next -- closed-union exhaustiveness guard; the directory names one of the six above. */
    default: return assertNever(reason, 'managed people refusal')
  }
}
