/**
 * The history section's slot store.
 *
 * The plugin's own read is the only writer of the entries; the section reads
 * through `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * @module @lyness/lyn-client-ui-settings-history/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'

/** Where the read stands. */
export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'forbidden'

/** What the section renders. */
export interface HistorySectionState {
  /** Where the read stands. */
  status: HistoryStatus
  /** The recorded changes the caller may read, newest first. */
  entries: readonly AuditEntryView[]
}

/** Declared action shape giving the exported factory a stable return type. */
type HistorySectionActions = {
  begin: (draft: HistorySectionState) => void
  succeed: (draft: HistorySectionState, entries: readonly AuditEntryView[]) => void
  fail: (draft: HistorySectionState, status: 'failed' | 'unavailable' | 'forbidden') => void
  reset: (draft: HistorySectionState) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createHistorySectionStore(): EngineStoreHandle<HistorySectionState, HistorySectionActions> {
  return defineStore({
    init: (): HistorySectionState => ({ status: 'idle', entries: [] }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, entries: readonly AuditEntryView[]) => {
        draft.status = 'ready'
        draft.entries = entries
      },
      // Three answers, not one: a deployment that keeps no trail has nothing
      // to retry, a caller who may not read it has nothing to retry either,
      // and only a read that broke does.
      fail: (draft, status: 'failed' | 'unavailable' | 'forbidden') => { draft.status = status },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
    },
  })
}
