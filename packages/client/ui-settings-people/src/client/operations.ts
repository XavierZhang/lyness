/**
 * The calls the people section makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a deployment that
 * maintains no directory told apart from a caller who may not maintain it and
 * from a read that broke, and a refusal reported with the fields the server
 * named so the form can mark them.
 *
 * Admitting an identity re-reads the people rather than patching one row: a
 * binding belongs to a person, and the server is the one that says which
 * identities they now have.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-people/client/operations
 */

import type { Context } from '@deepseek-ai/cordis'
import { createSharedRead, messageOf } from '@deepseek-ai/dsh-client-store'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-people-controller/remote'
import type {} from '@deepseek-ai/dsh-api-sign-in-channel-controller/remote'
import type { BindingInput, IdentityInput, PersonInput, PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import type { PeopleRead } from './store.ts'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the section performs, bound to one client context. */
export interface PeopleCalls {
  /** The people the caller may change. */
  list: () => Promise<CallOutcome<readonly PersonRowView[]>>
  /** The channels a binding may name. */
  channels: () => Promise<CallOutcome<readonly ConfiguredChannelView[]>>
  /** Add one person, or change one. */
  save: (input: PersonInput) => Promise<CallOutcome<PersonRowView>>
  /** Remove one person, and every identity admitted as them. */
  remove: (id: string) => Promise<CallOutcome<void>>
  /** Admit one directory identity as one person. */
  bind: (input: BindingInput) => Promise<CallOutcome<void>>
  /** Stop admitting one directory identity. */
  unbind: (input: IdentityInput) => Promise<CallOutcome<void>>
}

// Deliberately parallel to the sign-in channels section: sibling
// Settings sections backed by one deployment read keep the same
// shape, and their vocabularies — channels against people — are
// what differs. One shared base would have to name both.
/* jscpd:ignore-start */
/** Where an outcome is published. */
export interface PeopleSink {
  /** A read has started. */
  begin: () => void
  /** A read returned the people and the channels. */
  succeed: (read: PeopleRead) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A change has started. */
  work: () => void
  /** Somebody was added or changed, and this is what they now read as. */
  saved: (person: PersonRowView) => void
  /** Somebody was removed. */
  removed: (id: string) => void
  /** An identity was admitted or withdrawn, and this is who exists afterwards. */
  admitted: (update: { read: PeopleRead; outcome: { kind: 'bound'; subject: string } | { kind: 'unbound' } }) => void
  /** A change was refused, with the reason and the fields to mark. */
  refused: (refusal: { reason: string; fields: readonly string[] }) => void
}

/** What the section's injected face hands over. */
export interface PeopleOperations {
  /** Read the people and the channels, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Add one person, or change one. */
  save: (input: PersonInput) => Promise<void>
  /** Remove one person. */
  remove: (id: string) => Promise<void>
  /** Admit one directory identity as one person. */
  bind: (input: BindingInput) => Promise<void>
  /** Stop admitting one directory identity. */
  unbind: (input: IdentityInput) => Promise<void>
}

/* jscpd:ignore-end */

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the calls the section performs.
 */
export function peopleCallsOf(ctx: Context): PeopleCalls {
  return {
    list: () => ctx.remote.people.list(),
    channels: () => ctx.remote.signInChannels.list(),
    save: input => ctx.remote.people.save(input),
    remove: id => ctx.remote.people.remove(id),
    bind: input => ctx.remote.people.bind(input),
    unbind: input => ctx.remote.people.unbind(input),
  }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that maintains no directory will not grow one,
 * and a caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the section renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'people/no-standing') return 'forbidden'
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
    fields: error.code === 'people/incomplete' ? error.details.fields : [],
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createPeopleOperations(calls: PeopleCalls, sink: PeopleSink): PeopleOperations {
  const read = async (): Promise<PeopleRead | undefined> => {
    const [people, channels] = await Promise.all([calls.list(), calls.channels()])
    if (!people.ok) { sink.fail(statusOf(people.error)); return undefined }
    if (!channels.ok) { sink.fail(statusOf(channels.error)); return undefined }
    return { people: people.value, channels: channels.value }
  }

  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const answered = await read()
      if (answered !== undefined) sink.succeed(answered)
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  /** One identity change, followed by the read that says who exists afterwards. */
  const admitting = async (
    change: () => Promise<CallOutcome<void>>,
    outcome: { kind: 'bound'; subject: string } | { kind: 'unbound' },
  ): Promise<void> => {
    sink.work()
    try {
      const result = await change()
      if (!result.ok) { sink.refused(refusalOf(result.error)); return }
      const answered = await read()
      // A change that landed and a re-read that did not is still the change:
      // reporting it as refused would tell an administrator to do it again.
      if (answered !== undefined) sink.admitted({ read: answered, outcome })
    } catch (error: unknown) {
      sink.refused({ reason: messageOf(error), fields: [] })
    }
  }

  return {
    load: shared.load,
    retry: shared.retry,
    /* jscpd:ignore-start */
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
    /* jscpd:ignore-end */
    bind: input => admitting(() => calls.bind(input), { kind: 'bound', subject: input.subject }),
    unbind: input => admitting(() => calls.unbind(input), { kind: 'unbound' }),
  }
}
