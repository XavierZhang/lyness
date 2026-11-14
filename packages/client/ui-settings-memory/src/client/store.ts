/**
 * The memory section's slot store.
 *
 * The plugin's own calls are the only writer; the section reads through
 * `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * @module @lyness/lyn-client-ui-settings-memory/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'

/** Where the read stands. */
export type MemoryStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unowned'

/** What the section renders. */
export interface MemorySectionState {
  /** Where the read stands. */
  status: MemoryStatus
  /** This person's own entries, oldest first. */
  entries: MemoriesView['entries']
  /** The entry a removal is in flight for, so only its own row reports it. */
  removing: string | undefined
  /** Why the last removal was refused, when one was. */
  refused: string | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type MemorySectionActions = {
  begin: (draft: MemorySectionState) => void
  succeed: (draft: MemorySectionState, view: MemoriesView) => void
  fail: (draft: MemorySectionState) => void
  reset: (draft: MemorySectionState) => void
  work: (draft: MemorySectionState, id: string) => void
  refused: (draft: MemorySectionState, reason: string) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createMemorySectionStore(): EngineStoreHandle<MemorySectionState, MemorySectionActions> {
  return defineStore({
    init: (): MemorySectionState => ({
      status: 'idle',
      entries: [],
      removing: undefined,
      refused: undefined,
    }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      // A call that speaks for nobody is told apart from a person who has
      // nothing remembered: the first has nothing to read, and the second is
      // the ordinary empty state.
      succeed: (draft, view: MemoriesView) => {
        draft.status = view.owned ? 'ready' : 'unowned'
        draft.entries = view.entries
        draft.removing = undefined
        draft.refused = undefined
      },
      // The reason is the transport's and a reader can only retry, so the
      // section keeps no message it could show them.
      fail: (draft) => { draft.status = 'failed' },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft, id: string) => {
        draft.removing = id
        draft.refused = undefined
      },
      refused: (draft, reason: string) => {
        draft.removing = undefined
        draft.refused = reason
      },
    },
  })
}
