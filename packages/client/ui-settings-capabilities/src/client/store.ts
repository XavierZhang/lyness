/**
 * The capabilities section's slot store.
 *
 * The plugin's own read is the only writer; the section reads through
 * `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * @module @lyness/lyn-client-ui-settings-capabilities/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { AgentCapabilitiesView } from '@lyness/lyn-api-agent-capabilities-controller/types'
import type { ModelCatalog } from '@lyness/lyn-api-session-controller/types'

/** Where the read stands. */
export type CapabilitiesStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** What one read returned: the two answers this page joins. */
export interface CapabilitiesRead {
  /** Tools, connections and skills, each naming who gave it. */
  capabilities: AgentCapabilitiesView
  /** The models this deployment routes; absent when the catalog could not be read. */
  models: ModelCatalog | undefined
}

/** What the section renders. */
export interface CapabilitiesSectionState {
  /** Where the read stands. */
  status: CapabilitiesStatus
  /** Tools, connections and skills. */
  capabilities: AgentCapabilitiesView | undefined
  /**
   * The routable models, when the catalog answered. Absent is reported rather
   * than shown as "no models": a page that showed an empty model list would
   * say this deployment routes none.
   */
  models: ModelCatalog | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type CapabilitiesSectionActions = {
  begin: (draft: CapabilitiesSectionState) => void
  succeed: (draft: CapabilitiesSectionState, read: CapabilitiesRead) => void
  fail: (draft: CapabilitiesSectionState) => void
  reset: (draft: CapabilitiesSectionState) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createCapabilitiesSectionStore(): EngineStoreHandle<CapabilitiesSectionState, CapabilitiesSectionActions> {
  return defineStore({
    init: (): CapabilitiesSectionState => ({ status: 'idle', capabilities: undefined, models: undefined }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, read: CapabilitiesRead) => {
        draft.status = 'ready'
        draft.capabilities = read.capabilities
        draft.models = read.models
      },
      // The reason is the transport's and a reader can only retry, so the
      // section keeps no message it could show them.
      fail: (draft) => { draft.status = 'failed' },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
    },
  })
}
