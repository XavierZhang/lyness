/**
 * Wire vocabulary of the people surface, and its failure codes.
 *
 * Views rather than the seam's own records: what crosses the wire is who
 * exists, what they may do, and which directory identities sign in as them,
 * plus whether composition owns the entry — the one fact a surface needs to
 * know it must disable the row rather than offer an edit that would be undone
 * at the next boot.
 * @module @lyness/lyn-api-people-controller/types
 */

import type { Role } from '@lyness/lyn-people/types'

export type { Role } from '@lyness/lyn-people/types'

declare module '@lyness/lyn-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The calling standing may not make that change: it reached for another
     * organization's person, or tried to grant a standing it does not hold.
     */
    'people/not-permitted': Record<string, never>
    /**
     * Composition owns that person or binding. The installation's files name
     * them, so a change here would be undone at the next boot and is refused
     * instead of silently reverted.
     */
    'people/written': Record<string, never>
    /** The binding named somebody no half of the directory holds. */
    'people/unknown-person': Record<string, never>
    /**
     * That directory identity already signs in as somebody. One identity is
     * one person: a second binding would decide who by whichever row was read
     * first.
     */
    'people/already-bound': Record<string, never>
    /**
     * The binding named a bot. A bot holds a standing and owns conversations,
     * and no directory can authenticate one, so admitting an identity as a
     * bot would hand a human subject the bot's standing under its name.
     */
    'people/not-a-person': Record<string, never>
    /**
     * The submission left something out. `fields` names what, so a form marks
     * them together.
     */
    'people/incomplete': { readonly fields: readonly string[] }
    /**
     * The call established no standing to act in. Unreachable where the
     * deployment mounts an authorization rule, which refuses such a call
     * before it arrives; reachable where it mounts none, and refused here
     * rather than changing the directory on nobody's authority.
     */
    'people/no-standing': Record<string, never>
  }
}

/** One directory identity admitted as a person, as the surface shows it. */
export interface AdmittedIdentityView {
  /** The configured channel that authenticates them. */
  readonly channel: string
  /** The directory that channel reports, as it names it. */
  readonly issuer: string
  /** Their stable identity within that directory. */
  readonly subject: string
  /** Whether composition owns the binding, and the surface may not withdraw it. */
  readonly written: boolean
}

/** One person, as the configuration surface shows them. */
export interface PersonRowView {
  /** Stable identity; what a binding names and a conversation is attributed to. */
  readonly id: string
  /** Name a surface shows; never used for authorization. */
  readonly displayName: string
  /** What they may do. */
  readonly role: Role
  /** The organization their standing is in; absent for a platform administrator. */
  readonly organization?: string
  /** Whether composition owns the entry, and the surface may not change it. */
  readonly written: boolean
  /** The directory identities that sign in as them. */
  readonly bindings: readonly AdmittedIdentityView[]
}

/** What an administrator submits to add one person or change one. */
export interface PersonInput {
  /** The person to change; absent adds one. */
  readonly id?: string
  /** Name a surface shows. */
  readonly displayName: string
  /** What they may do. */
  readonly role: Role
  /** The organization their standing is in; absent for a platform administrator. */
  readonly organization?: string
}

/** One directory identity, as a submission names it. */
export interface IdentityInput {
  /** The configured channel that authenticates them. */
  readonly channel: string
  /** The directory that channel reports, as it names it. */
  readonly issuer: string
  /** Their stable identity within that directory. */
  readonly subject: string
}

/** What an administrator submits to admit one directory identity as one person. */
export interface BindingInput extends IdentityInput {
  /** The person that identity signs in as. */
  readonly person: string
}
