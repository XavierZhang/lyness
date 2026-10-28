/**
 * The sign-in surface's slot store.
 *
 * One store for both surfaces it registers — the screen that covers the
 * product and the row that names who is signed in — because both answer the
 * same question and asking twice would ask the deployment twice.
 *
 * @module @deepseek-ai/dsh-client-ui-sign-in/client/store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'

/** What the surfaces render. */
export interface ViewerState {
  /** Where the read stands. */
  status: 'idle' | 'loading' | 'ready' | 'failed'
  /** Who the viewer is and what they may sign in with; absent until a read succeeds. */
  viewer: ViewerView | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type ViewerActions = {
  begin: (draft: ViewerState) => void
  succeed: (draft: ViewerState, viewer: ViewerView) => void
  fail: (draft: ViewerState) => void
  reset: (draft: ViewerState) => void
}

/**
 * Declares the viewer state and write surface.
 * @returns the store handle.
 */
export function createViewerStore(): EngineStoreHandle<ViewerState, ViewerActions> {
  return defineStore({
    init: (): ViewerState => ({ status: 'idle', viewer: undefined }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, viewer: ViewerView) => {
        draft.status = 'ready'
        draft.viewer = viewer
      },
      // The reason is the transport's and a viewer can only retry, so the
      // surface keeps no message it could show them.
      fail: (draft) => { draft.status = 'failed' },
      // Dropped before a retry, so a viewer sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
    },
  })
}
