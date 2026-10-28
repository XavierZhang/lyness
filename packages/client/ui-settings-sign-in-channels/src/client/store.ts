/**
 * The sign-in channels section's slot store.
 *
 * The plugin's own read is the only writer of the kinds and the records; the
 * section reads through `props.useStore`. Keeping the read in the plugin
 * rather than in the component is what lets one in-flight read be shared by
 * every open surface.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-sign-in-channels/client/store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { ChannelKindView, ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'

/** Where the read stands. */
export type ChannelsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'forbidden'

/** What one change answered. */
export type ChannelsOutcome =
  | { kind: 'saved'; displayName: string }
  | { kind: 'removed' }
  | { kind: 'refused'; reason: string; fields: readonly string[] }

/** What the section renders. */
export interface ChannelsSectionState {
  /** Where the read stands. */
  status: ChannelsStatus
  /** The kinds this deployment can be configured with. */
  kinds: readonly ChannelKindView[]
  /** The configured channels the caller may change. */
  channels: readonly ConfiguredChannelView[]
  /** True while a save or a removal is in flight. */
  working: boolean
  /** What the last change answered, so the form reports its own outcome. */
  outcome: ChannelsOutcome | undefined
}

/** What one read returned. */
export interface ChannelsRead {
  /** The kinds this deployment can be configured with. */
  kinds: readonly ChannelKindView[]
  /** The configured channels the caller may change. */
  channels: readonly ConfiguredChannelView[]
}

/** Declared action shape giving the exported factory a stable return type. */
type ChannelsSectionActions = {
  begin: (draft: ChannelsSectionState) => void
  succeed: (draft: ChannelsSectionState, read: ChannelsRead) => void
  fail: (draft: ChannelsSectionState, status: 'failed' | 'unavailable' | 'forbidden') => void
  reset: (draft: ChannelsSectionState) => void
  work: (draft: ChannelsSectionState) => void
  saved: (draft: ChannelsSectionState, channel: ConfiguredChannelView) => void
  removed: (draft: ChannelsSectionState, id: string) => void
  refused: (draft: ChannelsSectionState, refusal: { reason: string; fields: readonly string[] }) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createChannelsSectionStore(): EngineStoreHandle<ChannelsSectionState, ChannelsSectionActions> {
  return defineStore({
    init: (): ChannelsSectionState => ({
      status: 'idle',
      kinds: [],
      channels: [],
      working: false,
      outcome: undefined,
    }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, read: ChannelsRead) => {
        draft.status = 'ready'
        draft.kinds = read.kinds
        draft.channels = read.channels
      },
      // Three answers, not one: a deployment that configures no channels has
      // nothing to retry, a caller who may not configure them has nothing to
      // retry either, and only a read that broke does.
      fail: (draft, status: 'failed' | 'unavailable' | 'forbidden') => { draft.status = status },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft) => {
        draft.working = true
        draft.outcome = undefined
      },
      saved: (draft, channel: ConfiguredChannelView) => {
        draft.working = false
        draft.outcome = { kind: 'saved', displayName: channel.displayName }
        const existing = draft.channels.findIndex(one => one.id === channel.id)
        // Replaced in place rather than appended: a save that renamed a
        // channel must not leave the old name in the list beside the new one.
        draft.channels = existing === -1
          ? [...draft.channels, channel]
          : draft.channels.map(one => one.id === channel.id ? channel : one)
      },
      removed: (draft, id: string) => {
        draft.working = false
        draft.outcome = { kind: 'removed' }
        draft.channels = draft.channels.filter(one => one.id !== id)
      },
      refused: (draft, refusal: { reason: string; fields: readonly string[] }) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason: refusal.reason, fields: refusal.fields }
      },
    },
  })
}
