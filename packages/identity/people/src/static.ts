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
 * @module @lyness/lyn-people/static
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import { PeopleDirectory, isRole } from './index.ts'
import type { Membership, MembershipId, Person, PersonId, Role } from './types.ts'

/** One person and their single standing, as an operator writes them. */
export interface PersonEntry {
  /** Stable identity; an operator chooses it and never reuses it. */
  id: string
  /** Name a surface shows. */
  displayName: string
  /** What this person may do. */
  role: string
  /** The organization their standing is in; omitted for a platform administrator. */
  organization?: string
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

const PersonEntrySchema: z<PersonEntry> = z.object({
  id: z.string().required(),
  displayName: z.string().required(),
  role: z.string().required(),
  organization: z.string(),
})

export const Config: z<Config> = z.object({
  people: z.array(PersonEntrySchema).required(),
})

/** One operator-written entry, resolved into a person and their standing. */
interface Resolved {
  readonly person: Person
  readonly membership: Membership
}

/**
 * Resolve one written entry, rejecting what the schema cannot express.
 *
 * The two rejections are the ones a surface cannot recover from: an unknown
 * role would silently admit nobody, and a tenant administrator with no
 * organization would administer nothing while reading as an administrator.
 * @param entry - one operator-written person.
 * @returns the person and the single standing they hold.
 * @throws {Error} when the role is unknown, or a tenant administrator names no organization.
 */
export function resolveEntry(entry: PersonEntry): Resolved {
  if (!isRole(entry.role)) {
    throw new Error(`people-static: "${entry.id}" has unknown role "${entry.role}"`)
  }
  const role: Role = entry.role
  if (role === 'tenant-administrator' && entry.organization === undefined) {
    throw new Error(`people-static: tenant administrator "${entry.id}" names no organization`)
  }
  const person: PersonId = brandString<PersonId>(entry.id)
  return {
    person: Object.freeze({ id: person, displayName: entry.displayName }),
    membership: Object.freeze({
      id: brandString<MembershipId>(`${entry.id}:${role}`),
      person,
      role,
      ...entry.organization === undefined ? {} : { organization: entry.organization },
    }),
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
      const { person, membership } = resolveEntry(entry)
      if (this.people.has(person.id)) {
        throw new Error(`people-static: duplicate person id "${entry.id}"`)
      }
      this.people.set(person.id, person)
      this.standings.set(membership.id, membership)
      this.byPerson.set(person.id, [membership])
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
   * Every standing one person holds; a written roster gives each exactly one.
   * @param person - the person whose standings to list.
   * @returns their standings, empty when the roster does not name them.
   */
  memberships(person: PersonId): Promise<readonly Membership[]> {
    return Promise.resolve(this.byPerson.get(person) ?? [])
  }
}

export default StaticPeopleDirectory
