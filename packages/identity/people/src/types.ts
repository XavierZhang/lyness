/**
 * Vocabulary for people, their standing in an organization, and the context a
 * call acts in.
 *
 * @module @deepseek-ai/dsh-people/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identity of one person, stable across every organization they belong to. */
export type PersonId = Branded<'PersonId'>

/** Opaque identity of one person's standing in one organization. */
export type MembershipId = Branded<'MembershipId'>

/**
 * What a membership may do.
 *
 * Three, and no more for now. A read-only auditor was considered and deferred:
 * it would add a role before anything asks for one.
 */
export type Role = 'platform-administrator' | 'tenant-administrator' | 'member'

/** Every role, for validation and for a surface that lists them. */
export const ROLES: readonly Role[] = ['platform-administrator', 'tenant-administrator', 'member']

/** One person, independent of any organization they belong to. */
export interface Person {
  /** Stable identity, unchanged by joining or leaving an organization. */
  readonly id: PersonId
  /** Name a surface shows; never used for authorization. */
  readonly displayName: string
}

/**
 * One person's standing in one organization.
 *
 * A membership carries exactly one role. A person holding standing in two
 * organizations holds two memberships, and nothing about the person says which
 * is in force — that is the acting context's job.
 */
export interface Membership {
  /** Stable identity of this standing. */
  readonly id: MembershipId
  /** The person whose standing this is. */
  readonly person: PersonId
  /**
   * The organization this standing is in, or absent for a platform
   * administrator, whose standing belongs to the platform rather than to any
   * organization.
   */
  readonly organization?: string | undefined
  /** What this standing may do. */
  readonly role: Role
}

/**
 * The context one call acts in.
 *
 * A call states it rather than having it inferred: a person with two
 * memberships makes a default a guess, and a guess here attributes a
 * conversation to the wrong organization.
 */
export interface ActingContext {
  /** The person making the call. */
  readonly person: PersonId
  /** The standing they act in; absent means their own personal context. */
  readonly membership?: MembershipId | undefined
}
