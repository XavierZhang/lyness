/**
 * The people section's slot store.
 *
 * The plugin's own read is the only writer of the people and the channels a
 * binding can name; the section reads through `props.useStore`. Keeping the
 * read in the plugin rather than in the component is what lets one in-flight
 * read be shared by every open surface.
 *
 * @module @lyness/lyn-client-ui-settings-people/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { PersonRowView } from '@lyness/lyn-api-people-controller/types'
import type { ConfiguredChannelView } from '@lyness/lyn-api-sign-in-channel-controller/types'

/** Where the read stands. */
export type PeopleStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'forbidden'

/** What one change answered. */
export type PeopleOutcome =
  | { kind: 'saved'; displayName: string }
  | { kind: 'removed' }
  | { kind: 'bound'; subject: string }
  | { kind: 'unbound' }
  | { kind: 'refused'; reason: string; fields: readonly string[] }

/** What the section renders. */
export interface PeopleSectionState {
  /** Where the read stands. */
  status: PeopleStatus
  /** The people the caller may change. */
  people: readonly PersonRowView[]
  /** The channels a binding may name. */
  channels: readonly ConfiguredChannelView[]
  /** True while a change is in flight. */
  working: boolean
  /** What the last change answered, so the form reports its own outcome. */
  outcome: PeopleOutcome | undefined
}

/** What one read returned. */
export interface PeopleRead {
  /** The people the caller may change. */
  people: readonly PersonRowView[]
  /** The channels a binding may name. */
  channels: readonly ConfiguredChannelView[]
}

/** Declared action shape giving the exported factory a stable return type. */
type PeopleSectionActions = {
  begin: (draft: PeopleSectionState) => void
  succeed: (draft: PeopleSectionState, read: PeopleRead) => void
  fail: (draft: PeopleSectionState, status: 'failed' | 'unavailable' | 'forbidden') => void
  reset: (draft: PeopleSectionState) => void
  work: (draft: PeopleSectionState) => void
  saved: (draft: PeopleSectionState, person: PersonRowView) => void
  removed: (draft: PeopleSectionState, id: string) => void
  admitted: (draft: PeopleSectionState, update: { read: PeopleRead; outcome: PeopleOutcome }) => void
  refused: (draft: PeopleSectionState, refusal: { reason: string; fields: readonly string[] }) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createPeopleSectionStore(): EngineStoreHandle<PeopleSectionState, PeopleSectionActions> {
  return defineStore({
    init: (): PeopleSectionState => ({
      status: 'idle',
      people: [],
      channels: [],
      working: false,
      outcome: undefined,
    }),
    actions: {
      // Deliberately parallel to the sign-in channels section: sibling
      // Settings sections backed by one deployment read keep the same
      // shape, and their vocabularies — channels against people — are
      // what differs. One shared base would have to name both.
      /* jscpd:ignore-start */
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, read: PeopleRead) => {
        draft.status = 'ready'
        draft.people = read.people
        draft.channels = read.channels
      },
      // Three answers, not one: a deployment that maintains no directory has
      // nothing to retry, a caller who may not maintain it has nothing to
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
      saved: (draft, person: PersonRowView) => {
        draft.working = false
        draft.outcome = { kind: 'saved', displayName: person.displayName }
        const existing = draft.people.findIndex(one => one.id === person.id)
        // Replaced in place rather than appended: a save that renamed
        // somebody must not leave the old name in the list beside the new one.
        draft.people = existing === -1
          ? [...draft.people, person]
          : draft.people.map(one => one.id === person.id ? person : one)
      },
      removed: (draft, id: string) => {
        draft.working = false
        draft.outcome = { kind: 'removed' }
        draft.people = draft.people.filter(one => one.id !== id)
      },
      // A binding is not a row of its own: what changed is whose identities
      // somebody has, so the people are read again rather than patched here.
      admitted: (draft, update: { read: PeopleRead; outcome: PeopleOutcome }) => {
        draft.working = false
        draft.outcome = update.outcome
        draft.people = update.read.people
        draft.channels = update.read.channels
      },
      refused: (draft, refusal: { reason: string; fields: readonly string[] }) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason: refusal.reason, fields: refusal.fields }
      },
    },
  })
}
