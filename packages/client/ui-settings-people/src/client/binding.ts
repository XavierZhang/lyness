/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @lyness/lyn-client-ui-settings-people/client/binding
 */

import type { PersonRowView } from '@lyness/lyn-api-people-controller/types'
import type { PeopleOperations, PeopleSink } from './operations.ts'
import type { PeopleRead } from './store.ts'
import type { PeopleSectionInjected } from './PeopleSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type PeopleActions = PeopleSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements PeopleSink {
  private actions: PeopleActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: PeopleActions): void {
    this.actions = actions
  }

  // Deliberately parallel to the sign-in channels section: sibling
  // Settings sections backed by one deployment read keep the same
  // shape, and their vocabularies — channels against people — are
  // what differs. One shared base would have to name both.
  /* jscpd:ignore-start */
  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read returned.
   * @param read - the people and the channels a binding may name.
   */
  succeed(read: PeopleRead): void { this.actions?.succeed(read) }

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
   * Report somebody who was added or changed.
   * @param person - what they now read as.
   */
  saved(person: PersonRowView): void { this.actions?.saved(person) }

  /**
   * Report somebody who was removed.
   * @param id - the person who is gone.
   */
  removed(id: string): void { this.actions?.removed(id) }

  /**
   * Report an identity that was admitted or withdrawn.
   * @param update - who exists afterwards, and which change it was.
   */
  admitted(update: {
    read: PeopleRead
    outcome: { kind: 'bound'; subject: string } | { kind: 'unbound' }
  }): void {
    this.actions?.admitted(update)
  }

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
 * @returns the factory the framework calls with the baked actions.
 */
export function sectionFace(
  binding: SectionBinding,
  operations: PeopleOperations,
): (actions: PeopleActions) => PeopleSectionInjected {
  return (actions: PeopleActions): PeopleSectionInjected => {
    binding.bind(actions)
    return {
      load: operations.load,
      retry: operations.retry,
      save: operations.save,
      remove: operations.remove,
      bind: operations.bind,
      unbind: operations.unbind,
    }
  }
}
