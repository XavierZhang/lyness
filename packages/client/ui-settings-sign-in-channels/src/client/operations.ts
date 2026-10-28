/**
 * The calls the sign-in channels section makes, and the sharing around the
 * read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a deployment that
 * configures no channels told apart from a caller who may not configure them
 * and from a read that broke, and a refusal reported with the fields the
 * server named so the form can mark them.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-sign-in-channels/client/operations
 */

import type { Context } from '@deepseek-ai/cordis'
import { createSharedRead, messageOf } from '@deepseek-ai/dsh-client-store'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-sign-in-channel-controller/remote'
import type {
  ChannelInput, ChannelKindView, ConfiguredChannelView,
} from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import type { ChannelsRead } from './store.ts'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The three calls the section performs, bound to one client context. */
export interface ChannelsCalls {
  /** The kinds this deployment can be configured with. */
  kinds: () => Promise<CallOutcome<readonly ChannelKindView[]>>
  /** The configured channels the caller may change. */
  list: () => Promise<CallOutcome<readonly ConfiguredChannelView[]>>
  /** Create one channel, or replace one that exists. */
  save: (input: ChannelInput) => Promise<CallOutcome<ConfiguredChannelView>>
  /** Remove one channel, its secret with it. */
  remove: (id: string) => Promise<CallOutcome<void>>
}

/** Where an outcome is published. */
export interface ChannelsSink {
  /** A read has started. */
  begin: () => void
  /** A read returned the kinds and the records. */
  succeed: (read: ChannelsRead) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A change has started. */
  work: () => void
  /** A channel was created or replaced, and this is what it now reads as. */
  saved: (channel: ConfiguredChannelView) => void
  /** A channel was removed. */
  removed: (id: string) => void
  /** A change was refused, with the reason and the fields to mark. */
  refused: (refusal: { reason: string; fields: readonly string[] }) => void
}

/** What the section's injected face hands over. */
export interface ChannelsOperations {
  /** Read the kinds and the records, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Create one channel, or replace one that exists. */
  save: (input: ChannelInput) => Promise<void>
  /** Remove one channel. */
  remove: (id: string) => Promise<void>
}

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the calls the section performs.
 */
export function channelsCallsOf(ctx: Context): ChannelsCalls {
  return {
    kinds: () => ctx.remote.signInChannels.kinds(),
    list: () => ctx.remote.signInChannels.list(),
    save: input => ctx.remote.signInChannels.save(input),
    remove: id => ctx.remote.signInChannels.remove(id),
  }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that mounts no store will not grow one, and a
 * caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the section renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'sign-in-channels/no-standing') return 'forbidden'
  return 'failed'
}

/**
 * What a refusal is published as, with the fields a form marks.
 *
 * Only an incomplete submission names fields, and reading them from its own
 * code is what keeps the form from marking a field on a refusal that was
 * about something else.
 */
function refusalOf(error: RemoteFailure): { reason: string; fields: readonly string[] } {
  return {
    reason: error.message,
    fields: error.code === 'sign-in-channels/incomplete' ? error.details.fields : [],
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createChannelsOperations(calls: ChannelsCalls, sink: ChannelsSink): ChannelsOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const [kinds, channels] = await Promise.all([calls.kinds(), calls.list()])
      if (!kinds.ok) { sink.fail(statusOf(kinds.error)); return }
      if (!channels.ok) { sink.fail(statusOf(channels.error)); return }
      sink.succeed({ kinds: kinds.value, channels: channels.value })
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  return {
    load: shared.load,
    retry: shared.retry,
    save: async (input): Promise<void> => {
      sink.work()
      try {
        const result = await calls.save(input)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.saved(result.value)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
    remove: async (id): Promise<void> => {
      sink.work()
      try {
        const result = await calls.remove(id)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.removed(id)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
  }
}
