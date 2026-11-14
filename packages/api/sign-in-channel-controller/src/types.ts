/**
 * Wire vocabulary of the sign-in channel surface, and its failure codes.
 *
 * Views rather than the seam's own records: a record holds the credential
 * reference its secret is stored under, and that name never crosses the wire.
 * What crosses instead is what an administrator typed and whether the channel
 * it describes is serving.
 * @module @deepseek-ai/dsh-api-sign-in-channel-controller/types
 */

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The calling standing may not configure that channel: a tenant
     * administrator reached for another organization's, or for the
     * deployment's own.
     */
    'sign-in-channels/not-permitted': Record<string, never>
    /**
     * No plugin offers the kind the submission named. Its own outcome rather
     * than an invalid request: the same submission is accepted by a
     * deployment that mounts that kind's package.
     */
    'sign-in-channels/unknown-kind': { readonly kind: string }
    /**
     * The submission left something out. `fields` names the settings that
     * were empty, so a form marks them together; it is empty when what was
     * missing is the application secret a new channel cannot be created
     * without.
     */
    'sign-in-channels/incomplete': { readonly fields: readonly string[] }
    /**
     * The call established no standing to act in. Unreachable where the
     * deployment mounts an authorization rule, which refuses such a call
     * before it arrives; reachable where it mounts none, and refused here
     * rather than configured on nobody's authority.
     */
    'sign-in-channels/no-standing': Record<string, never>
  }
}

/** One setting a kind needs, as a form renders it. */
export interface ChannelFieldView {
  /** Setting name, as the submission keys it. */
  readonly name: string
  /** What to label the field with. */
  readonly label: string
  /** Whether the kind refuses a channel without it. */
  readonly required: boolean
}

/** One kind a deployment may configure a channel of. */
export interface ChannelKindView {
  /** The kind id a submission names. */
  readonly id: string
  /** What to call it in the form. */
  readonly displayName: string
  /** The settings it needs, beside the application secret. */
  readonly fields: readonly ChannelFieldView[]
}

/** One configured channel, as the configuration surface shows it. */
export interface ConfiguredChannelView {
  /** Stable id; the channel id a sign-in path carries. */
  readonly id: string
  /** The kind that builds it. */
  readonly kind: string
  /** Name the sign-in screen shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /** When it was configured, as a UTC instant. */
  readonly configuredAt: string
  /** Who configured it. */
  readonly configuredBy: string
  /**
   * Whether it is serving.
   *
   * A stored channel whose kind nothing offers, or whose settings that kind
   * refuses, reads as not mounted: the record is kept so an administrator can
   * correct it rather than retype it.
   */
  readonly mounted: boolean
}

/** What an administrator submits to create or replace one channel. */
export interface ChannelInput {
  /** The id to replace; absent creates one. */
  readonly id?: string
  /** The kind that builds it. */
  readonly kind: string
  /** Name the sign-in screen shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /**
   * The application secret itself.
   *
   * Absent on a replacement leaves the stored one alone, so a channel can be
   * renamed without retyping a secret nobody can read back.
   */
  readonly secret?: string
}
