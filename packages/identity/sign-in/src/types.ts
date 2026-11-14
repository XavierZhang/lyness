/**
 * Vocabulary for signing in through an external directory.
 *
 * @module @lyness/lyn-sign-in/types
 */

import type { AuthSessionId } from '@lyness/lyn-auth-session'
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

/** Where one redirect sign-in stands, so its caller can be sent onward. */
export interface RedirectStart {
  /** The directory's own page to send the browser to. */
  readonly to: string
  /** The attempt this redirect belongs to, presented again on the way back. */
  readonly attempt: string
}

/** What a surface needs to offer one channel as a sign-in option. */
export interface ChannelDescription {
  /** The channel to name when starting a sign-in. */
  readonly id: ChannelId
  /** Name a surface shows on the button. */
  readonly displayName: string
  /**
   * Which shape this channel signs in with.
   *
   * A surface needs it before it starts: a redirect channel sends the browser
   * away and comes back to a callback the surface has to own, while a
   * self-driven one returns a session in place.
   */
  readonly kind: ChannelKind
  /**
   * The organization this channel belongs to; absent means the deployment's.
   *
   * A deployment serving several organizations offers each one its own
   * directory and nobody else's: a channel configured by one tenant's
   * administrator must not appear on another tenant's sign-in page. A
   * deployment-wide channel is offered to everyone, which is what a
   * standalone installation has.
   */
  readonly organization?: string | undefined
}

/** The two shapes a sign-in channel comes in. */
export type ChannelKind = 'self-driven' | 'redirect'

/** Why a sign-in did not produce a session. */
export type SignInRefusal =
  /** No channel of that id is mounted. */
  | 'channel-unknown'
  /** The directory did not complete the sign-in. */
  | 'not-authenticated'
  /** The directory authenticated them, and this deployment admits nobody by that identity. */
  | 'not-admitted'
  /** The channel drives its own round trip, so there is nothing to resume. */
  | 'nothing-to-resume'

/**
 * How one sign-in ended.
 *
 * Two outcomes rather than one because the two channel shapes end differently:
 * a channel that owns its own browser round trip has a session by the time it
 * returns, while a redirect channel has only told us where to send the person
 * next. A caller that handled just one of these would work for the desktop
 * client and not the web app, or the reverse.
 */
export type SignInOutcome =
  /** The person is signed in; this is their session. */
  | { readonly kind: 'session'; readonly session: AuthSessionId }
  /** Send the browser here; the sign-in finishes when it comes back. */
  | { readonly kind: 'redirect'; readonly start: RedirectStart }
