/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-instructions/client/binding
 */

import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'
import type { InstructionsOperations, InstructionsSink } from './operations.ts'
import type { InstructionsSectionInjected } from './InstructionsSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type InstructionsActions = InstructionsSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements InstructionsSink {
  private actions: InstructionsActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: InstructionsActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read answered.
   * @param view - what is saved and what the deployment accepts.
   */
  succeed(view: InstructionsView): void { this.actions?.succeed(view) }

  /** Report that a read did not answer. */
  fail(): void { this.actions?.fail() }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a save has started. */
  work(): void { this.actions?.work() }

  /**
   * Report a save that landed.
   * @param view - what the deployment now holds.
   */
  saved(view: InstructionsView): void { this.actions?.saved(view) }

  /**
   * Report a save that was refused.
   * @param reason - what the server said.
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
 * @returns the factory the framework calls with the baked actions.
 */
export function sectionFace(
  binding: SectionBinding,
  operations: InstructionsOperations,
): (actions: InstructionsActions) => InstructionsSectionInjected {
  return (actions: InstructionsActions): InstructionsSectionInjected => {
    binding.bind(actions)
    return { load: operations.load, retry: operations.retry, save: operations.save }
  }
}
