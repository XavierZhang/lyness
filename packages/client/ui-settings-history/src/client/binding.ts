/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-history/client/binding
 */

import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import type { HistoryOperations, HistorySink } from './operations.ts'
import type { HistorySectionInjected } from './HistorySection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the call publishes, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type HistoryActions = HistorySink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements HistorySink {
  private actions: HistoryActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: HistoryActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read returned.
   * @param entries - the recorded changes, newest first.
   */
  succeed(entries: readonly AuditEntryView[]): void { this.actions?.succeed(entries) }

  /**
   * Report that a read did not return them.
   * @param status - whether the deployment keeps none, the caller may not read it, or the read broke.
   */
  fail(status: 'failed' | 'unavailable' | 'forbidden'): void { this.actions?.fail(status) }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a continuation has started. */
  appending(): void { this.actions?.appending() }

  /**
   * Report what a continuation returned.
   * @param entries - the next, older entries; empty means there are none.
   */
  appended(entries: readonly AuditEntryView[]): void { this.actions?.appended(entries) }
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
  operations: HistoryOperations,
): (actions: HistoryActions) => HistorySectionInjected {
  return (actions: HistoryActions): HistorySectionInjected => {
    binding.bind(actions)
    return { load: operations.load, retry: operations.retry, loadMore: operations.loadMore }
  }
}
