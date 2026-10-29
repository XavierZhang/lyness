/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-memory/client/binding
 */

import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'
import type { MemoryOperations, MemorySink } from './operations.ts'
import type { MemorySectionInjected } from './MemorySection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type MemoryActions = MemorySink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements MemorySink {
  private actions: MemoryActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: MemoryActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read answered.
   * @param view - this person's own entries.
   */
  succeed(view: MemoriesView): void { this.actions?.succeed(view) }

  /** Report that a read did not answer. */
  fail(): void { this.actions?.fail() }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /**
   * Report that a removal has started.
   * @param id - the entry being removed.
   */
  work(id: string): void { this.actions?.work(id) }

  /**
   * Report a removal that was refused.
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
  operations: MemoryOperations,
): (actions: MemoryActions) => MemorySectionInjected {
  return (actions: MemoryActions): MemorySectionInjected => {
    binding.bind(actions)
    return { load: operations.load, retry: operations.retry, forget: operations.forget }
  }
}
