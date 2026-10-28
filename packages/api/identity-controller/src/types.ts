/**
 * Wire vocabulary of the viewer surface: who a caller is, and what this
 * deployment would let them sign in with.
 *
 * One answer rather than two calls, because a surface deciding what to render
 * needs both at once: a signed-out viewer of a deployment with no accounts
 * sees the product, and a signed-out viewer of one with accounts sees a
 * sign-in screen. Asking separately would render the wrong one first.
 *
 * @module @deepseek-ai/dsh-api-identity-controller/types
 */

/** One sign-in channel a surface may offer. */
export interface ChannelOfferView {
  /** The channel id the sign-in path names. */
  readonly id: string
  /** Name to show on the button. */
  readonly displayName: string
  /**
   * Whether the browser leaves for the directory's own page.
   *
   * A surface needs it before it starts: a redirect channel is a link, while
   * a self-driven one completes in the process that owns the browser and
   * cannot be offered by a server at all.
   */
  readonly redirect: boolean
}

/** The person a call speaks for, as a surface shows them. */
export interface ViewerPersonView {
  /** Stable identity, unchanged by joining or leaving an organization. */
  readonly id: string
  /** Name to show; never used for authorization. */
  readonly displayName: string
}

/** The standing one call acts in. */
export interface ViewerStandingView {
  /** Stable identity of the standing. */
  readonly id: string
  /** What it may do. */
  readonly role: 'platform-administrator' | 'tenant-administrator' | 'member'
  /** The organization it is in; absent for a platform administrator. */
  readonly organization?: string
}

/** Who the caller is, and what this deployment offers them. */
export interface ViewerView {
  /**
   * Whether this deployment has accounts at all.
   *
   * False is the single-operator shape: nobody signs in, nobody is refused,
   * and a surface showing a sign-in screen would be showing a door with no
   * wall around it.
   */
  readonly accounts: boolean
  /** The person this call speaks for; absent when it presented no identity. */
  readonly person?: ViewerPersonView
  /** The standing they act in; absent for a personal context. */
  readonly standing?: ViewerStandingView
  /** The channels a surface may offer; empty when none is mounted. */
  readonly channels: readonly ChannelOfferView[]
  /** Where a surface sends the browser to begin one, with the channel id appended. */
  readonly signInPrefix: string
  /** Where a surface sends the browser to sign out. */
  readonly signOutPath: string
}
