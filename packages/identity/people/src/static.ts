/**
 * Provider: the people an operator writes in composition config.
 *
 * This is the enterprise shape's source of truth before an SSO directory is
 * connected, and the shape a customer's administrator maintains: an
 * installation runs on one customer's own servers for their own staff, so one
 * written roster is the whole directory, and only the people it names may use
 * the system.
 *
 * A hosted deployment mounts a store-backed directory instead, because its
 * people arrive by sign-up rather than by an operator's edit.
 *
 * @module @deepseek-ai/dsh-people/static
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { PeopleDirectory, isRole } from './index.ts'
import type { Membership, MembershipId, Person, PersonId, Role } from './types.ts'

/** One standing an operator writes under a person who holds several. */
export interface StandingEntry {
  /** What this standing may do. */
  role: string
  /** The organization it is in; omitted for a platform administrator. */
  organization?: string
}

/**
 * One person and the standing or standings they hold, as an operator writes
 * them.
 *
 * Two forms, and exactly one per entry: `role` (with `organization`) writes
 * the one standing most people hold, and `standings` writes several for
 * somebody who belongs to more than one organization. Both at once, or
 * neither, is an unfinished edit rather than a meaning.
 */
export interface PersonEntry {
  /** Stable identity; an operator chooses it and never reuses it. */
  id: string
  /** Name a surface shows. */
  displayName: string
  /** What this person may do, for a person holding one standing. */
  role?: string
  /** The organization that standing is in; omitted for a platform administrator. */
  organization?: string
  /** The standings this person holds, for somebody holding more than one. */
  standings?: StandingEntry[]
}

/** Operator-written roster for an installation with one directory. */
export interface Config {
  /**
   * The people who may use this installation.
   *
   * Required: an installation naming nobody admits nobody, and an empty
   * roster is far likelier an unfinished edit than an intention.
   */
  people: PersonEntry[]
}

const StandingEntrySchema: z<StandingEntry> = z.object({
  role: z.string().required(),
  organization: z.string(),
})

const PersonEntrySchema: z<PersonEntry> = z.object({
  id: z.string().required(),
  displayName: z.string().required(),
  role: z.string(),
  organization: z.string(),
  standings: z.array(StandingEntrySchema),
})

export const Config: z<Config> = z.object({
  people: z.array(PersonEntrySchema).required(),
})

/** One operator-written entry, resolved into a person and the standings they hold. */
interface Resolved {
  readonly person: Person
  /** Their standings, in written order; never empty. */
  readonly memberships: readonly Membership[]
}

/**
 * The standing identity one written entry gives.
 *
 * The shorthand form keeps `<person>:<role>`, which is what every roster
 * written so far produced: a membership id that moved would leave a
 * signed-in session, and every invitation issued in that standing, naming
 * one nothing holds. The listed form is new, so it carries the organization
 * too and two standings of one role stay apart.
 * @param id - the person's written identity.
 * @param role - the standing's role.
 * @param organization - the organization it is in, when it names one.
 * @param listed - whether it came from `standings` rather than from `role`.
 * @returns the standing's identity.
 */
function standingId(id: string, role: Role, organization: string | undefined, listed: boolean): MembershipId {
  if (!listed) return brandString<MembershipId>(`${id}:${role}`)
  return brandString<MembershipId>(`${id}:${organization ?? 'platform'}:${role}`)
}

/**
 * Resolve one written standing, rejecting what the schema cannot express.
 *
 * The two rejections are the ones a surface cannot recover from: an unknown
 * role would silently admit nobody, and a tenant administrator with no
 * organization would administer nothing while reading as an administrator.
 * @param id - the person's written identity.
 * @param standing - the written role and organization.
 * @param listed - whether it came from `standings` rather than from `role`.
 * @returns the standing.
 * @throws {Error} when the role is unknown, or a tenant administrator names no organization.
 */
function resolveStanding(id: string, standing: StandingEntry, listed: boolean): Membership {
  if (!isRole(standing.role)) {
    throw new Error(`people-static: "${id}" has unknown role "${standing.role}"`)
  }
  const role: Role = standing.role
  if (role === 'tenant-administrator' && standing.organization === undefined) {
    throw new Error(`people-static: tenant administrator "${id}" names no organization`)
  }
  return Object.freeze({
    id: standingId(id, role, standing.organization, listed),
    person: brandString<PersonId>(id),
    role,
    ...standing.organization === undefined ? {} : { organization: standing.organization },
  })
}

/**
 * Resolve one written entry, rejecting what the schema cannot express.
 *
 * Beside the two refusals each standing makes, an entry writing both forms or
 * neither is refused, and so is one listing the same standing twice: each
 * would decide somebody's authority by whichever row was read first.
 * @param entry - one operator-written person.
 * @returns the person and the standings they hold.
 * @throws {Error} when the entry writes both forms or neither, repeats a
 * standing, names an unknown role, or administers a tenant it does not name.
 */
export function resolveEntry(entry: PersonEntry): Resolved {
  const listed = entry.standings ?? []
  if (entry.role === undefined && listed.length === 0) {
    throw new Error(`people-static: "${entry.id}" names no standing; write \`role\` or a non-empty \`standings\``)
  }
  if (entry.role !== undefined && listed.length > 0) {
    throw new Error(`people-static: "${entry.id}" writes both \`role\` and \`standings\`; write one of them`)
  }
  const written: readonly { standing: StandingEntry; listed: boolean }[] = entry.role === undefined
    ? listed.map(standing => ({ standing, listed: true }))
    : [{ standing: { role: entry.role, ...entry.organization === undefined ? {} : { organization: entry.organization } }, listed: false }]
  const memberships: Membership[] = []
  const seen = new Set<MembershipId>()
  for (const { standing, listed: fromList } of written) {
    const membership = resolveStanding(entry.id, standing, fromList)
    if (seen.has(membership.id)) {
      throw new Error(`people-static: "${entry.id}" holds "${membership.role}" in that organization twice`)
    }
    seen.add(membership.id)
    memberships.push(membership)
  }
  return {
    person: Object.freeze({ id: brandString<PersonId>(entry.id), displayName: entry.displayName }),
    memberships: Object.freeze(memberships),
  }
}

/** The people an operator wrote, served unchanged for every lookup. */
export class StaticPeopleDirectory extends PeopleDirectory {
  static readonly Config = Config

  private readonly people = new Map<PersonId, Person>()
  private readonly standings = new Map<MembershipId, Membership>()
  private readonly byPerson = new Map<PersonId, Membership[]>()

  /**
   * @param ctx - the context this directory serves.
   * @param config - validated operator-written roster.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    if (config.people.length === 0) {
      throw new Error('people-static: `people` must name at least one person')
    }
    for (const entry of config.people) {
      const { person, memberships } = resolveEntry(entry)
      if (this.people.has(person.id)) {
        throw new Error(`people-static: duplicate person id "${entry.id}"`)
      }
      this.people.set(person.id, person)
      for (const membership of memberships) this.standings.set(membership.id, membership)
      this.byPerson.set(person.id, [...memberships])
    }
  }

  /**
   * One person by identity.
   * @param id - the person's stable identity.
   * @returns the person, or undefined when the roster does not name them.
   */
  person(id: PersonId): Promise<Person | undefined> {
    return Promise.resolve(this.people.get(id))
  }

  /**
   * One standing by identity.
   * @param id - the membership's stable identity.
   * @returns the standing, or undefined when the roster does not name it.
   */
  membership(id: MembershipId): Promise<Membership | undefined> {
    return Promise.resolve(this.standings.get(id))
  }

  /**
   * Every standing one person holds, as their entry wrote them.
   * @param person - the person whose standings to list.
   * @returns their standings, empty when the roster does not name them.
   */
  memberships(person: PersonId): Promise<readonly Membership[]> {
    return Promise.resolve(this.byPerson.get(person) ?? [])
  }
}

export default StaticPeopleDirectory
