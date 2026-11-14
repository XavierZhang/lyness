/**
 * Vocabulary of a managed directory: the people and admission bindings a
 * deployment stores, what an administrator submits to change them, and what
 * a surface shows.
 *
 * @module @lyness/lyn-managed-people/types
 */

import type { Membership, MembershipId, Person, PersonId, Role } from '@lyness/lyn-people'

/** What kind of actor one roster entry is. */
export type PersonKind = 'person' | 'bot'

/** One person another owner holds, and the standings they hold. */
export interface DeclaredPerson {
  /** The person, as a lookup answers them. */
  readonly person: Person
  /** The standings they hold, in the owner's own order; never empty. */
  readonly memberships: readonly Membership[]
  /**
   * Whether this entry is a human or a bot; absent reads as a human.
   *
   * The directory treats both the same, because a bot owns conversations and
   * is attributed like anybody else. Admission does not: a bot is never a
   * verified subject, and a surface says which it is showing rather than
   * offering to admit an identity as one.
   */
  readonly kind?: PersonKind | undefined
}

/** One standing a stored person holds. */
export interface StandingRecord {
  /** Stable identity of this standing; generated here and never reused. */
  readonly id: MembershipId
  /** What this standing may do. */
  readonly role: Role
  /** The organization it is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /** When it was granted, as a UTC instant. */
  readonly addedAt: string
  /** Who granted it. */
  readonly addedBy: PersonId
}

/**
 * One person an administrator added, as the deployment stores them.
 *
 * `standings` is what this generation writes, and the one a reader uses.
 * `role` and `organization` are the single standing the first generation
 * wrote: a record saved then still reads, and the next write of that record
 * replaces both with a one-entry `standings`. Exactly one of the two forms is
 * present in any stored record.
 */
export interface PersonRecord {
  /** Stable identity, generated here and never reused. */
  readonly id: PersonId
  /** Name a surface shows; never used for authorization. */
  readonly displayName: string
  /** The standings they hold, oldest first; absent only in a first-generation record. */
  readonly standings?: readonly StandingRecord[] | undefined
  /** What this person may do, in a first-generation record. */
  readonly role?: Role | undefined
  /** The organization that standing is in, in a first-generation record. */
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

/** What an administrator submits to grant one further standing. */
export interface StandingSubmission {
  /** The person who holds it. */
  readonly person: PersonId
  /** What the standing may do. */
  readonly role: Role
  /** The organization it is in; absent for a platform administrator. */
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

/** One standing as a surface shows it. */
export interface StandingView {
  /** Stable identity of the standing; what a binding and a session name. */
  readonly id: MembershipId
  /** What it may do. */
  readonly role: Role
  /** The organization it is in; absent for a platform administrator. */
  readonly organization?: string | undefined
}

/** One person as a surface shows them, with the identities that sign in as them. */
export interface PersonView {
  /** Stable identity. */
  readonly id: PersonId
  /** Whether this entry is a human or a bot. */
  readonly kind: PersonKind
  /** Name a surface shows. */
  readonly displayName: string
  /** Every standing they hold, oldest first; never empty. */
  readonly standings: readonly StandingView[]
  /**
   * What this person may do in their first standing.
   *
   * The first of {@link standings}, carried beside it while the surfaces that
   * show one standing per person move over. A person holding several is not
   * described by it, which is why anything deciding what to offer reads the
   * list instead.
   */
  readonly role: Role
  /** The organization that first standing is in; absent for a platform administrator. */
  readonly organization?: string | undefined
  /**
   * Whether this person is maintained somewhere other than here.
   *
   * A written person belongs to the installation's files or to the bot
   * roster: changing or removing them here would be undone by the owner that
   * holds them, so it is refused instead. Which owner is `kind`.
   */
  readonly written: boolean
  /** The directory identities that sign in as them, oldest first. */
  readonly bindings: readonly BindingView[]
}
