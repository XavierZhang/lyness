/**
 * The join between the calls and the store the framework bakes for the
 * section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-sign-in-channels/client/binding
 */

import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import type { ChannelsOperations, ChannelsSink } from './operations.ts'
import type { ChannelsRead } from './store.ts'
import type { ChannelsSectionInjected } from './ChannelsSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type ChannelsActions = ChannelsSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements ChannelsSink {
  private actions: ChannelsActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: ChannelsActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read returned.
   * @param read - the kinds and the configured channels.
   */
  succeed(read: ChannelsRead): void { this.actions?.succeed(read) }

  /**
   * Report that a read did not return them.
   * @param status - whether the deployment configures none, the caller may not, or the read broke.
   */
  fail(status: 'failed' | 'unavailable' | 'forbidden'): void { this.actions?.fail(status) }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a change has started. */
  work(): void { this.actions?.work() }

  /**
   * Report a channel that was created or replaced.
   * @param channel - what it now reads as.
   */
  saved(channel: ConfiguredChannelView): void { this.actions?.saved(channel) }

  /**
   * Report a channel that was removed.
   * @param id - the channel that is gone.
   */
  removed(id: string): void { this.actions?.removed(id) }

  /**
   * Report a change that was refused.
   * @param refusal - what the server said, and the fields it named.
   */
  refused(refusal: { reason: string; fields: readonly string[] }): void { this.actions?.refused(refusal) }
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
  operations: ChannelsOperations,
): (actions: ChannelsActions) => ChannelsSectionInjected {
  return (actions: ChannelsActions): ChannelsSectionInjected => {
    binding.bind(actions)
    return {
      load: operations.load,
      retry: operations.retry,
      save: operations.save,
      remove: operations.remove,
    }
  }
}
