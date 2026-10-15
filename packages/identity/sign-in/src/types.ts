/**
 * Vocabulary for signing in through an external directory.
 *
 * @module @lyness/lyn-sign-in/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** Opaque identity of one configured sign-in channel. */
export type ChannelId = Branded<'ChannelId'>

/**
 * One person as the directory that authenticated them reports it.
 *
 * The three identifying fields are kept apart rather than joined into one
 * string because they are compared separately: two directories can hand out
 * the same subject, and the same directory reached through two channels is
 * still one directory.
 */
export interface ExternalSubject {
  /** The channel that performed the sign-in. */
  readonly channel: ChannelId
  /** The directory that authenticated them, as that channel names it. */
  readonly issuer: string
  /** Stable identity within that directory; never a name or an address. */
  readonly subject: string
  /** Name a surface shows, as the directory holds it; absent when it publishes none. */
  readonly displayName?: string | undefined
  /** Sign-in address, as the directory holds it; absent when it publishes none. */
  readonly address?: string | undefined
}

/** What a surface needs to offer one channel as a sign-in option. */
export interface ChannelDescription {
  /** The channel to name when starting a sign-in. */
  readonly id: ChannelId
  /** Name a surface shows on the button. */
  readonly displayName: string
}

/** Why a sign-in did not produce a session. */
export type SignInRefusal =
  /** No channel of that id is mounted. */
  | 'channel-unknown'
  /** The directory did not complete the sign-in. */
  | 'not-authenticated'
  /** The directory authenticated them, and this deployment admits nobody by that identity. */
  | 'not-admitted'
