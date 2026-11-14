/**
 * Service Definition for people and their standing in an organization.
 *
 * This is what "only an administrator may change the models" needs before it
 * can mean anything: without people there is no administrator, and the tenant
 * configuration controller already records that restricting saves to
 * administrators waits for exactly this.
 *
 * The directory answers three questions and decides nothing. Whether a
 * standing may perform an operation is the operation's own decision, made
 * against the role this directory reports — a directory that also authorized
 * would put every rule in one place and none of them where it is enforced.
 *
 * @module @deepseek-ai/dsh-people
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { Membership, MembershipId, Person, PersonId, Role } from './types.ts'

export type { ActingContext, Membership, MembershipId, Person, PersonId, Role } from './types.ts'
export { ROLES } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** People and their standing in an organization; absent on a deployment with no identities. */
    people: PeopleDirectory
  }
}

/**
 * Abstract people directory. Subclass and implement the three lookups for one
 * source of truth; a deployment mounts exactly one.
 *
 * A deployment that mounts none has no identities, which is what a
 * single-operator developer install is: it is its own administrator.
 */
export abstract class PeopleDirectory extends Service {
  /**
   * @param ctx - the context this directory serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'people')
  }

  /**
   * One person by identity.
   * @param id - the person's stable identity.
   * @returns the person, or undefined when no such identity exists.
   */
  abstract person(id: PersonId): Promise<Person | undefined>

  /**
   * One standing by identity.
   * @param id - the membership's stable identity.
   * @returns the standing, or undefined when no such standing exists.
   */
  abstract membership(id: MembershipId): Promise<Membership | undefined>

  /**
   * Every standing one person holds.
   *
   * Returned rather than filtered by organization because a surface offering a
   * context switch needs all of them, and an authorization check needs the one
   * the call named — neither is served by a per-organization query.
   * @param person - the person whose standings to list.
   * @returns their standings, in a stable order.
   */
  abstract memberships(person: PersonId): Promise<readonly Membership[]>
}

/**
 * Whether a standing administers the organization it belongs to.
 *
 * A platform administrator administers every organization, which is why this
 * is one predicate rather than a role comparison at each call site: an
 * operation asking "may this standing administer here" should not have to
 * remember that the platform role outranks the tenant one.
 * @param membership - the standing a call acts in.
 * @param organization - the organization the operation affects.
 * @returns true when the standing may administer that organization.
 */
export function administers(membership: Membership, organization: string | undefined): boolean {
  if (membership.role === 'platform-administrator') return true
  if (membership.role !== 'tenant-administrator') return false
  return membership.organization !== undefined && membership.organization === organization
}

/**
 * Whether a role names a standing this deployment knows.
 * @param value - candidate role text, typically from configuration.
 * @returns true when it is one of the three roles.
 */
export function isRole(value: string): value is Role {
  return value === 'platform-administrator' || value === 'tenant-administrator' || value === 'member'
}

export default PeopleDirectory
