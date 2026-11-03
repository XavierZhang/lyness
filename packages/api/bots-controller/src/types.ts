/**
 * Wire vocabulary of the bots surface, and its failure codes.
 *
 * Views rather than the seam's own records: what crosses the wire is which
 * bots exist, what each is for, which preset it runs with, and the two facts
 * a surface acts on — whether composition owns the entry, so the row is
 * shown rather than offered for editing, and whether its preset is one this
 * deployment still offers, so a bot that will not run says so.
 * @module @lyness/lyn-api-bots-controller/types
 */

declare module '@lyness/lyn-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The calling standing may not make that change: it reached for another
     * organization's bot, or named an organization it does not administer.
     */
    'bots/not-permitted': Record<string, never>
    /**
     * Composition owns that bot. The installation's files name it, so a
     * change here would be undone at the next boot and is refused instead of
     * silently reverted.
     */
    'bots/written': Record<string, never>
    /**
     * The bot named a preset this deployment does not offer. Capabilities are
     * selected from what the deployment mounted, never written, so a name
     * nothing answers is refused rather than stored.
     */
    'bots/unknown-preset': Record<string, never>
    /**
     * The team named a bot its organization does not hold. Team membership is
     * what grants one bot the right to ask another, so a team holding a bot
     * from elsewhere would hand that right across an organization boundary.
     */
    'bots/unknown-bot': Record<string, never>
    /**
     * The call may not speak as that bot. Reported here for completeness of
     * the roster's refusals; the surface that reaches it is `session.create`,
     * which answers `session/bot-forbidden`.
     */
    'bots/not-yours': Record<string, never>
    /**
     * The submission left something out. `fields` names what, so a form marks
     * them together.
     */
    'bots/incomplete': { readonly fields: readonly string[] }
    /**
     * The call established no standing to act in. Unreachable where the
     * deployment mounts an authorization rule, which refuses such a call
     * before it arrives; reachable where it mounts none, and refused here
     * rather than performed on nobody's authority.
     */
    'bots/no-standing': Record<string, never>
  }
}

/** One bot as the surface shows it. */
export interface BotRowView {
  /** Stable identity; what a conversation this bot opens is attributed to. */
  readonly id: string
  /** Name a surface shows, and the name it speaks under. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** System-prompt prose giving it its character. */
  readonly persona: string
  /** What it is for, in the author's words. */
  readonly job: string
  /** The agent preset it runs with. */
  readonly preset: string
  /** Whether composition owns the entry, and the surface may not change it. */
  readonly written: boolean
  /** Whether the preset it names is one this deployment still offers. */
  readonly available: boolean
}

/** What an administrator fills in to add one bot or change one. */
export interface BotInput {
  /** The bot to change; absent adds one. */
  readonly id?: string
  /** Name a surface shows. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** System-prompt prose giving it its character. */
  readonly persona: string
  /** What it is for, in the author's words. */
  readonly job: string
  /** The agent preset it runs with. */
  readonly preset: string
}

/** One agent preset a bot may be given. */
export interface PresetOptionView {
  /** Stable preset id, which is what a bot stores. */
  readonly id: string
  /** Display name the preset published; absent leaves the id as the label. */
  readonly displayName?: string
  /** One sentence on what this preset is for. */
  readonly description?: string
}

/** One team as the surface shows it. */
export interface TeamRowView {
  /** Stable identity. */
  readonly id: string
  /** Name a surface shows. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** The bots in it, in the order they were named. */
  readonly members: readonly string[]
  /** Whether composition owns the entry, and the surface may not change it. */
  readonly written: boolean
}

/** What an administrator fills in to add one team or change one. */
export interface TeamInput {
  /** The team to change; absent adds one. */
  readonly id?: string
  /** Name a surface shows. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** The bots in it. */
  readonly members: readonly string[]
}
