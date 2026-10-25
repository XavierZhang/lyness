/**
 * Vocabulary of a bot roster: the bots a deployment stores, what an
 * administrator submits to change them, and what a surface shows.
 *
 * @module @lyness/lyn-managed-bots/types
 */

import type { PersonId } from '@lyness/lyn-people'

/** One bot composition wrote, which an administrator may read and not change. */
export interface DeclaredBot {
  /** Stable identity, the operator's to choose and keep. */
  readonly id: PersonId
  /** Name a surface shows, and the name it speaks under. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** System-prompt prose giving it its character. */
  readonly persona: string
  /** What it is for, in the author's words, as its teammates and its readers see it. */
  readonly job: string
  /** The agent preset whose tools, prompt sections and skills it runs with. */
  readonly preset: string
}

/** One bot an administrator added, as the deployment stores it. */
export interface BotRecord extends DeclaredBot {
  /** When it was added, as a UTC instant. */
  readonly addedAt: string
  /** Who added it. */
  readonly addedBy: PersonId
}

/** What an administrator submits to add one bot or change one they added. */
export interface BotSubmission {
  /** The bot to change; absent adds one. */
  readonly id?: PersonId | undefined
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

/** One bot as a surface shows it. */
export interface BotView extends DeclaredBot {
  /**
   * Whether this bot comes from composition configuration.
   *
   * A written bot is the operator's: the installation's files name it, so
   * changing or removing it here would be undone at the next boot and is
   * refused instead.
   */
  readonly written: boolean
  /**
   * Whether the preset it names is one this deployment currently offers.
   *
   * A stored bot outlives the composition that offered its preset, and
   * deleting it because a row left the profile would lose the character an
   * administrator wrote. False says it will not run until the preset is back.
   */
  readonly available: boolean
}

/** One agent preset a bot may be given, as this deployment currently offers it. */
export interface PresetOption {
  /** Stable preset id, which is what a bot stores. */
  readonly id: string
  /** Display name the preset published; absent leaves the id as the label. */
  readonly displayName?: string | undefined
  /** One sentence on what this preset is for. */
  readonly description?: string | undefined
}

/** One team composition wrote, which an administrator may read and not change. */
export interface DeclaredTeam {
  /** Stable identity, the operator's to choose and keep. */
  readonly id: string
  /** Name a surface shows. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** The bots in it, in the order they were named. */
  readonly members: readonly PersonId[]
}

/** One team an administrator added, as the deployment stores it. */
export interface TeamRecord extends DeclaredTeam {
  /** When it was added, as a UTC instant. */
  readonly addedAt: string
  /** Who added it. */
  readonly addedBy: PersonId
}

/** What an administrator submits to add one team or change one they added. */
export interface TeamSubmission {
  /** The team to change; absent adds one. */
  readonly id?: string | undefined
  /** Name a surface shows. */
  readonly displayName: string
  /** The organization it belongs to. */
  readonly organization: string
  /** The bots in it. */
  readonly members: readonly PersonId[]
}

/** One team as a surface shows it. */
export interface TeamView extends DeclaredTeam {
  /**
   * Whether this team comes from composition configuration.
   *
   * A written team is the operator's: the installation's files name it, so
   * changing or removing it here would be undone at the next boot and is
   * refused instead.
   */
  readonly written: boolean
}

/**
 * One bot as a teammate reads it.
 *
 * What a bot may learn about another is this and nothing else: enough to
 * decide who to ask, and no conversation of theirs. The character is included
 * because asking the right teammate means knowing how it answers.
 */
export interface TeammateView {
  /** The teammate's stable identity, which an ask names. */
  readonly id: PersonId
  /** The name it speaks under. */
  readonly displayName: string
  /** What it is for, in its author's words. */
  readonly job: string
  /** The character it answers with. */
  readonly persona: string
  /** The preset it runs with. */
  readonly preset: string
}
