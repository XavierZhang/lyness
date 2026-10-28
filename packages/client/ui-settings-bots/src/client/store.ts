/**
 * The bots section's slot store.
 *
 * The plugin's own read is the only writer of the bots and the presets one
 * may be given; the section reads through `props.useStore`. Keeping the read
 * in the plugin rather than in the component is what lets one in-flight read
 * be shared by every open surface.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-bots/client/store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { BotRowView, PresetOptionView, TeamRowView } from '@deepseek-ai/dsh-api-bots-controller/types'

/** Where the read stands. */
export type BotsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'forbidden'

/** What one change answered. */
export type BotsOutcome =
  | { kind: 'saved'; displayName: string }
  | { kind: 'removed' }
  | { kind: 'team-saved'; displayName: string }
  | { kind: 'team-removed' }
  | { kind: 'refused'; reason: string; fields: readonly string[] }

/** What the section renders. */
export interface BotsSectionState {
  /** Where the read stands. */
  status: BotsStatus
  /** The bots the caller may change. */
  bots: readonly BotRowView[]
  /** The presets a bot may be given. */
  presets: readonly PresetOptionView[]
  /** The teams the caller may change. */
  teams: readonly TeamRowView[]
  /** True while a change is in flight. */
  working: boolean
  /** What the last change answered, so the form reports its own outcome. */
  outcome: BotsOutcome | undefined
}

/** What one read returned. */
export interface BotsRead {
  /** The bots the caller may change. */
  bots: readonly BotRowView[]
  /** The presets a bot may be given. */
  presets: readonly PresetOptionView[]
  /** The teams the caller may change. */
  teams: readonly TeamRowView[]
}

/** Declared action shape giving the exported factory a stable return type. */
type BotsSectionActions = {
  begin: (draft: BotsSectionState) => void
  succeed: (draft: BotsSectionState, read: BotsRead) => void
  fail: (draft: BotsSectionState, status: 'failed' | 'unavailable' | 'forbidden') => void
  reset: (draft: BotsSectionState) => void
  work: (draft: BotsSectionState) => void
  saved: (draft: BotsSectionState, bot: BotRowView) => void
  removed: (draft: BotsSectionState, id: string) => void
  teamSaved: (draft: BotsSectionState, team: TeamRowView) => void
  teamRemoved: (draft: BotsSectionState, id: string) => void
  refused: (draft: BotsSectionState, refusal: { reason: string; fields: readonly string[] }) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createBotsSectionStore(): EngineStoreHandle<BotsSectionState, BotsSectionActions> {
  return defineStore({
    init: (): BotsSectionState => ({
      status: 'idle',
      bots: [],
      presets: [],
      teams: [],
      working: false,
      outcome: undefined,
    }),
    actions: {
      // Deliberately parallel to the people section: sibling Settings
      // sections backed by one deployment read keep the same shape, and
      // their vocabularies — bots against people — are what differs. One
      // shared base would have to name both.
      /* jscpd:ignore-start */
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, read: BotsRead) => {
        draft.status = 'ready'
        draft.bots = read.bots
        draft.presets = read.presets
        draft.teams = read.teams
      },
      // Three answers, not one: a deployment that maintains no bots has
      // nothing to retry, a caller who may not maintain them has nothing to
      // retry either, and only a read that broke does.
      fail: (draft, status: 'failed' | 'unavailable' | 'forbidden') => { draft.status = status },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft) => {
        draft.working = true
        draft.outcome = undefined
      },
      /* jscpd:ignore-end */
      saved: (draft, bot: BotRowView) => {
        draft.working = false
        draft.outcome = { kind: 'saved', displayName: bot.displayName }
        const existing = draft.bots.findIndex(one => one.id === bot.id)
        // Replaced in place rather than appended: a save that renamed a bot
        // must not leave the old name in the list beside the new one.
        draft.bots = existing === -1
          ? [...draft.bots, bot]
          : draft.bots.map(one => one.id === bot.id ? bot : one)
      },
      // What a removal and a refusal do to the section's own state, which
      // every Settings roster does the same way: drop the row, or keep the
      // reason and the fields a form marks.
      /* jscpd:ignore-start */
      removed: (draft, id: string) => {
        draft.working = false
        draft.outcome = { kind: 'removed' }
        draft.bots = draft.bots.filter(one => one.id !== id)
      },
      teamSaved: (draft, team: TeamRowView) => {
        draft.working = false
        draft.outcome = { kind: 'team-saved', displayName: team.displayName }
        const existing = draft.teams.findIndex(one => one.id === team.id)
        draft.teams = existing === -1
          ? [...draft.teams, team]
          : draft.teams.map(one => one.id === team.id ? team : one)
      },
      teamRemoved: (draft, id: string) => {
        draft.working = false
        draft.outcome = { kind: 'team-removed' }
        draft.teams = draft.teams.filter(one => one.id !== id)
      },
      refused: (draft, refusal: { reason: string; fields: readonly string[] }) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason: refusal.reason, fields: refusal.fields }
      },
      /* jscpd:ignore-end */
    },
  })
}
