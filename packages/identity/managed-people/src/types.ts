/**
 * Vocabulary of a managed directory: the people and admission bindings a
 * deployment stores, what an administrator submits to change them, and what
 * a surface shows.
 *
 * @module @lyness/lyn-managed-people/types
 */

import type { Membership, Person, PersonId, Role } from '@lyness/lyn-people'

/** One person composition wrote, and the single standing they hold. */
export interface DeclaredPerson {
  /** The person, as a lookup answers them. */
  readonly person: Person
  /** The standing they hold. */
  readonly membership: Membership
}

/** One person an administrator added, as the deployment stores them. */
export interface PersonRecord {
  /** Stable identity, generated here and never reused. */
  readonly id: PersonId
  /** Name a surface shows; never used for authorization. */
  readonly displayName: string
  /** What this person may do. */
  readonly role: Role
  /** The organization their standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /** When they were added, as a UTC instant. */
  readonly addedAt: string
  /** Who added them. */
  readonly addedBy: PersonId
}

/** One directory identity an administrator admitted, as the deployment stores it. */
export interface BindingRecord {
  /** The channel that authenticates them. */
  readonly channel: string
  /** The directory that channel reports, as it names it. */
  readonly issuer: string
  /** Their stable identity within that directory. */
  readonly subject: string
  /** The person they sign in as. */
  readonly person: PersonId
  /** When the binding was written, as a UTC instant. */
  readonly boundAt: string
  /** Who wrote it. */
  readonly boundBy: PersonId
}

/** What an administrator submits to add one person or change one they added. */
export interface PersonSubmission {
  /** The person to change; absent adds one. */
  readonly id?: PersonId | undefined
  /** Name a surface shows. */
  readonly displayName: string
  /** What this person may do. */
  readonly role: Role
  /** The organization their standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
}

/** What an administrator submits to admit one directory identity. */
export interface BindingSubmission {
  /** The channel that authenticates them. */
  readonly channel: string
  /** The directory that channel reports, as it names it. */
  readonly issuer: string
  /** Their stable identity within that directory. */
  readonly subject: string
  /** The person they sign in as. */
  readonly person: PersonId
}

/** One admission binding as a surface shows it. */
export interface BindingView {
  /** The channel that authenticates them. */
  readonly channel: string
  /** The directory that channel reports. */
  readonly issuer: string
  /** Their stable identity within that directory. */
  readonly subject: string
  /**
   * Whether this binding comes from composition configuration.
   *
   * A written binding is the operator's and cannot be removed here; the
   * surface shows it so an administrator can see who signs in as this
   * person without opening the installation's files.
   */
  readonly written: boolean
}

/** One person as a surface shows them, with the identities that sign in as them. */
export interface PersonView {
  /** Stable identity. */
  readonly id: PersonId
  /** Name a surface shows. */
  readonly displayName: string
  /** What this person may do. */
  readonly role: Role
  /** The organization their standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /**
   * Whether this person comes from composition configuration.
   *
   * A written person is the operator's: the installation's files name them,
   * so changing or removing them here would be undone at the next boot and
   * is refused instead.
   */
  readonly written: boolean
  /** The directory identities that sign in as them, oldest first. */
  readonly bindings: readonly BindingView[]
}
