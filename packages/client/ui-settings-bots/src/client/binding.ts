/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-bots/client/binding
 */

import type { BotRowView, TeamRowView } from '@lyness/lyn-api-bots-controller/types'
import type { BotsOperations, BotsSink } from './operations.ts'
import type { BotsRead } from './store.ts'
import type { BotsSectionInjected } from './BotsSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type BotsActions = BotsSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements BotsSink {
  private actions: BotsActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: BotsActions): void {
    this.actions = actions
  }

  // Deliberately parallel to the people section: sibling Settings sections
  // backed by one deployment read keep the same shape, and their
  // vocabularies — bots against people — are what differs. One shared base
  // would have to name both.
  /* jscpd:ignore-start */
  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read returned.
   * @param read - the bots and the presets one may be given.
   */
  succeed(read: BotsRead): void { this.actions?.succeed(read) }

  /**
   * Report that a read did not return them.
   * @param status - whether the deployment maintains none, the caller may not, or the read broke.
   */
  fail(status: 'failed' | 'unavailable' | 'forbidden'): void { this.actions?.fail(status) }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a change has started. */
  work(): void { this.actions?.work() }

  /**
   * Report a bot that was added or changed.
   * @param bot - what it now reads as.
   */
  saved(bot: BotRowView): void { this.actions?.saved(bot) }

  /**
   * Report a bot that was removed.
   * @param id - the bot that is gone.
   */
  removed(id: string): void { this.actions?.removed(id) }

  /**
   * Report a team that was added or changed.
   * @param team - what it now reads as.
   */
  teamSaved(team: TeamRowView): void { this.actions?.teamSaved(team) }

  /**
   * Report a team that was removed.
   * @param id - the team that is gone.
   */
  teamRemoved(id: string): void { this.actions?.teamRemoved(id) }

  /**
   * Report a change that was refused.
   * @param refusal - what the server said, and the fields it named.
   */
  refused(refusal: { reason: string; fields: readonly string[] }): void { this.actions?.refused(refusal) }
  /* jscpd:ignore-end */
}

/**
 * Build the inject factory the section is registered with.
 *
 * It is a named function rather than a closure in `apply` so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param operations - the calls the section drives.
 * @param talk - opens a new conversation with one bot.
 * @returns the factory the framework calls with the baked actions.
 */
export function sectionFace(
  binding: SectionBinding,
  operations: BotsOperations,
  talk: (id: string) => void,
): (actions: BotsActions) => BotsSectionInjected {
  return (actions: BotsActions): BotsSectionInjected => {
    binding.bind(actions)
    return {
      load: operations.load,
      retry: operations.retry,
      talk,
      save: operations.save,
      remove: operations.remove,
      saveTeam: operations.saveTeam,
      removeTeam: operations.removeTeam,
    }
  }
}
