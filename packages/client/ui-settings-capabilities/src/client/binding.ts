/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-capabilities/client/binding
 */

import type { CapabilitiesOperations, CapabilitiesSink } from './operations.ts'
import type { CapabilitiesRead } from './store.ts'
import type { CapabilitiesSectionInjected } from './CapabilitiesSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type CapabilitiesActions = CapabilitiesSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements CapabilitiesSink {
  private actions: CapabilitiesActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: CapabilitiesActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read answered.
   * @param read - the two answers this page joins.
   */
  succeed(read: CapabilitiesRead): void { this.actions?.succeed(read) }

  /** Report that a read did not answer. */
  fail(): void { this.actions?.fail() }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

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
  operations: CapabilitiesOperations,
): (actions: CapabilitiesActions) => CapabilitiesSectionInjected {
  return (actions: CapabilitiesActions): CapabilitiesSectionInjected => {
    binding.bind(actions)
    return { load: operations.load, retry: operations.retry }
  }
}
