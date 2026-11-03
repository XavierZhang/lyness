/**
 * The calls the bots section makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a deployment that
 * maintains no bots told apart from a caller who may not maintain them and
 * from a read that broke, and a refusal reported with the fields the server
 * named so the form can mark them.
 *
 * @module @lyness/lyn-client-ui-settings-bots/client/operations
 */

import type { Context } from '@lyness/cordis'
import { createSharedRead, messageOf } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-bots-controller/remote'
import type {
  BotInput, BotRowView, PresetOptionView, TeamInput, TeamRowView,
} from '@lyness/lyn-api-bots-controller/types'
import type { BotsRead } from './store.ts'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the section performs, bound to one client context. */
export interface BotsCalls {
  /** The bots the caller may change. */
  list: () => Promise<CallOutcome<readonly BotRowView[]>>
  /** The presets a bot may be given. */
  presets: () => Promise<CallOutcome<readonly PresetOptionView[]>>
  /** Add one bot, or change one. */
  save: (input: BotInput) => Promise<CallOutcome<BotRowView>>
  /** Remove one bot. */
  remove: (id: string) => Promise<CallOutcome<void>>
  /** The teams the caller may change. */
  teams: () => Promise<CallOutcome<readonly TeamRowView[]>>
  /** Add one team, or change one. */
  saveTeam: (input: TeamInput) => Promise<CallOutcome<TeamRowView>>
  /** Remove one team. */
  removeTeam: (id: string) => Promise<CallOutcome<void>>
}

// Deliberately parallel to the people section: sibling Settings sections
// backed by one deployment read keep the same shape, and their
// vocabularies — bots against people — are what differs. One shared base
// would have to name both.
/* jscpd:ignore-start */
/** Where an outcome is published. */
export interface BotsSink {
  /** A read has started. */
  begin: () => void
  /** A read returned the bots, the presets and the teams. */
  succeed: (read: BotsRead) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A change has started. */
  work: () => void
  /** A bot was added or changed, and this is what it now reads as. */
  saved: (bot: BotRowView) => void
  /** A bot was removed. */
  removed: (id: string) => void
  /** A team was added or changed, and this is what it now reads as. */
  teamSaved: (team: TeamRowView) => void
  /** A team was removed. */
  teamRemoved: (id: string) => void
  /** A change was refused, with the reason and the fields to mark. */
  refused: (refusal: { reason: string; fields: readonly string[] }) => void
}

/** What the section's injected face hands over. */
export interface BotsOperations {
  /** Read the bots and the presets, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Add one bot, or change one. */
  save: (input: BotInput) => Promise<void>
  /** Remove one bot. */
  remove: (id: string) => Promise<void>
  /** Add one team, or change one. */
  saveTeam: (input: TeamInput) => Promise<void>
  /** Remove one team. */
  removeTeam: (id: string) => Promise<void>
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
export function botsCallsOf(ctx: Context): BotsCalls {
  return {
    list: () => ctx.remote.bots.list(),
    presets: () => ctx.remote.bots.presets(),
    save: input => ctx.remote.bots.save(input),
    remove: id => ctx.remote.bots.remove(id),
    teams: () => ctx.remote.bots.teams(),
    saveTeam: input => ctx.remote.bots.saveTeam(input),
    removeTeam: id => ctx.remote.bots.removeTeam(id),
  }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that maintains no bots will not grow any, and a
 * caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the section renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'bots/no-standing') return 'forbidden'
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
    fields: error.code === 'bots/incomplete' ? error.details.fields : [],
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createBotsOperations(calls: BotsCalls, sink: BotsSink): BotsOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const [bots, presets, teams] = await Promise.all([calls.list(), calls.presets(), calls.teams()])
      if (!bots.ok) { sink.fail(statusOf(bots.error)); return }
      if (!presets.ok) { sink.fail(statusOf(presets.error)); return }
      if (!teams.ok) { sink.fail(statusOf(teams.error)); return }
      sink.succeed({ bots: bots.value, presets: presets.value, teams: teams.value })
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

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
    saveTeam: async (input): Promise<void> => {
      sink.work()
      try {
        const result = await calls.saveTeam(input)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.teamSaved(result.value)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
    removeTeam: async (id): Promise<void> => {
      sink.work()
      try {
        const result = await calls.removeTeam(id)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.teamRemoved(id)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
    /* jscpd:ignore-end */
  }
}
