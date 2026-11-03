/**
 * Vocabulary of a configured sign-in channel: the record a deployment stores,
 * and what an administrator submits to create or replace one.
 *
 * @module @deepseek-ai/dsh-sign-in-channels/types
 */

import type { PersonId } from '@deepseek-ai/dsh-people'

/** One configured channel, as the deployment stores it. */
export interface ChannelRecord {
  /** Stable id; the channel id a binding names and a sign-in path carries. */
  readonly id: string
  /** The kind that builds it, such as `wecom`. */
  readonly kind: string
  /** Name a sign-in page shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string | undefined
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /** Credential reference holding this instance's application secret. */
  readonly secret: string
  /** When it was configured, as a UTC instant. */
  readonly configuredAt: string
  /** Who configured it. */
  readonly configuredBy: PersonId
}

/** What an administrator submits to create or replace one channel. */
export interface ChannelSubmission {
  /** The id to replace; absent creates one. */
  readonly id?: string | undefined
  /** The kind that builds it. */
  readonly kind: string
  /** Name a sign-in page shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string | undefined
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /**
   * The application secret itself.
   *
   * Absent on a replacement leaves the stored one alone, so an administrator
   * can rename a channel without retyping a secret they cannot read back.
   */
  readonly secret?: string | undefined
}

/** One configured channel as a surface shows it; the secret never appears. */
export interface ChannelView {
  /** Stable id; the channel id a binding names. */
  readonly id: string
  /** The kind that builds it. */
  readonly kind: string
  /** Name a sign-in page shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string | undefined
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /** When it was configured, as a UTC instant. */
  readonly configuredAt: string
  /** Who configured it. */
  readonly configuredBy: string
  /**
   * Whether this channel is mounted.
   *
   * A record whose kind nothing offers stays stored and unmounted: removing
   * it because a plugin was taken out of the composition would lose the
   * configuration a deployment would need back when it returns.
   */
  readonly mounted: boolean
}
