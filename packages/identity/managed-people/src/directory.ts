/**
 * Provider: a people directory an administrator maintains, over the roster
 * composition wrote.
 *
 * It reads the same `people` configuration the static directory does, so an
 * installation that already wrote its roster keeps it, and adds the people
 * its administrators have added since. The written half wins every lookup:
 * composition is re-read at every boot, so a stored entry that shadowed one
 * would be the configuration for as long as nobody restarted.
 *
 * @module @lyness/lyn-managed-people/directory
 */

import type { Context } from '@lyness/cordis'
import { PeopleDirectory } from '@lyness/lyn-people'
import { Config as rosterConfig, resolveEntry } from '@lyness/lyn-people/static'
import type { Config } from '@lyness/lyn-people/static'
import type { Membership, MembershipId, Person, PersonId } from '@lyness/lyn-people'
import type {} from './index.ts'
import type { DeclaredPerson } from './types.ts'

export type { Config } from '@lyness/lyn-people/static'

/**
 * Resolve the written roster, rejecting what nobody could recover from.
 *
 * An installation naming nobody admits nobody and has no administrator to
 * add the first person, and one id written twice decides somebody's standing
 * by whichever row was read first.
 * @param config - the operator-written roster.
 * @returns each written person and their standing, in written order.
 * @throws {Error} when the roster is empty, or names one person twice.
 */
export function declaredPeople(config: Config): readonly DeclaredPerson[] {
  if (config.people.length === 0) {
    throw new Error('managed-people: `people` must name at least one person, who administers the rest')
  }
  const declared: DeclaredPerson[] = []
  const seen = new Set<PersonId>()
  for (const entry of config.people) {
    const resolved = resolveEntry(entry)
    if (seen.has(resolved.person.id)) {
      throw new Error(`managed-people: duplicate person id "${resolved.person.id}"`)
    }
    seen.add(resolved.person.id)
    declared.push(resolved)
  }
  return declared
}

/** The people an operator wrote, plus the ones administrators added. */
export class ManagedPeopleDirectory extends PeopleDirectory {
  static inject = ['managedPeople']

  static readonly Config = rosterConfig

  /**
   * @param ctx - context carrying the managed directory.
   * @param config - validated operator-written roster.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    // Registered as effects so a reload withdraws exactly what this
    // composition declared, leaving the stored half untouched.
    for (const entry of declaredPeople(config)) ctx.effect(() => ctx.managedPeople.declarePerson(entry))
  }

  /**
   * One person by identity.
   * @param id - the person's stable identity.
   * @returns the person, or undefined when neither half names them.
   */
  person(id: PersonId): Promise<Person | undefined> {
    return this.ctx.managedPeople.person(id)
  }

  /**
   * One standing by identity.
   * @param id - the standing's stable identity.
   * @returns the standing, or undefined when neither half holds it.
   */
  membership(id: MembershipId): Promise<Membership | undefined> {
    return this.ctx.managedPeople.membership(id)
  }

  /**
   * Every standing one person holds.
   * @param person - the person whose standings to list.
   * @returns their standings, in a stable order.
   */
  memberships(person: PersonId): Promise<readonly Membership[]> {
    return this.ctx.managedPeople.memberships(person)
  }
}

export default ManagedPeopleDirectory
