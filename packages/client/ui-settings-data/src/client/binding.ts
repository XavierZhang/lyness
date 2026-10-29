/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A call
 * that settles before that publishes to nobody rather than failing.
 *
 * @module @lyness/lyn-client-ui-settings-data/client/binding
 */

import type { DataOperations, DataSink } from './operations.ts'
import type { DataSectionInjected } from './DataSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The confirmation writes are the store's alone: nothing is called when a
 * reader asks or changes their mind, so they never reach the calls at all.
 */
export interface DataActions extends DataSink {
  /** Ask about one conversation. */
  confirm: (id: string) => void
  /** Drop the question. */
  cancel: () => void
}

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements DataSink {
  private actions: DataActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: DataActions): void {
    this.actions = actions
  }

  /**
   * Report that a deletion has started.
   * @param id - the conversation being deleted.
   */
  work(id: string): void { this.actions?.work(id) }

  /**
   * Report what a deletion removed.
   * @param removed - how many stored sessions went.
   */
  done(removed: number): void { this.actions?.done(removed) }

  /**
   * Report a deletion that was refused.
   * @param reason - what the deployment said.
   */
  refused(reason: string): void { this.actions?.refused(reason) }
}

/**
 * Build the inject factory the section is registered with.
 *
 * It is a named function rather than a closure in `apply` so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param operations - the calls the section drives.
 * @param sources - the observable sources the framework turns into `useXxx` props.
 * @param exportConversation - starts one conversation's download.
 * @returns the factory the framework calls with the baked actions.
 */
export function sectionFace(
  binding: SectionBinding,
  operations: DataOperations,
  sources: DataSectionInjected['hooks'],
  exportConversation: (id: string) => void,
): (actions: DataActions) => DataSectionInjected {
  return (actions: DataActions): DataSectionInjected => {
    binding.bind(actions)
    return {
      hooks: sources,
      confirm: (id: string) => { actions.confirm(id) },
      cancel: () => { actions.cancel() },
      remove: operations.remove,
      exportConversation,
    }
  }
}
