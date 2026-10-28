/**
 * The join between the read and the store the framework bakes for the row.
 *
 * The actions arrive later than the read does: the plugin registers at load,
 * while the store instance is baked when the row first renders. A read that
 * settles before that publishes to nobody rather than failing, which is what
 * lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-announcements/client/binding
 */

import type { Announcement } from '@lyness/lyn-announcements/types'
import type { AnnouncementsReader, ReaderSink } from './read.ts'
import type { AnnouncementsRowInjected } from './AnnouncementsRow.tsx'

/** The store writes this row performs, as the framework hands them over. */
export interface AnnouncementActions {
  /** A read has started. */
  begin: () => void
  /** A read returned this list. */
  succeed: (announcements: readonly Announcement[]) => void
  /** A read did not return a list. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
}

/** Publishes read outcomes to the baked store, once there is one. */
export class RowBinding implements ReaderSink {
  private actions: AnnouncementActions | undefined

  /**
   * Take the store writes the framework baked for this row.
   * @param actions - the bound actions.
   */
  bind(actions: AnnouncementActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report the list a read returned.
   * @param announcements - what the deployment published.
   */
  succeed(announcements: readonly Announcement[]): void { this.actions?.succeed(announcements) }

  /** Report that a read did not return a list. */
  fail(): void { this.actions?.fail() }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }
}

/**
 * Build the inject factory the row is registered with.
 *
 * It is a named function rather than a closure in `apply` so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param reader - the read the row drives.
 * @returns the factory the framework calls with the baked actions.
 */
export function rowFace(
  binding: RowBinding,
  reader: AnnouncementsReader,
): (actions: AnnouncementActions) => AnnouncementsRowInjected {
  return (actions: AnnouncementActions): AnnouncementsRowInjected => {
    binding.bind(actions)
    return { load: reader.load, retry: reader.retry }
  }
}
