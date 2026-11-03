/**
 * The announcements row's slot store.
 *
 * The plugin's own read is the only writer; the row and its reader read
 * through `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-announcements/client/settings-store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { Announcement } from '@deepseek-ai/dsh-announcements/types'

/** What the row and the reader render. */
export interface AnnouncementsRowState {
  /** Where the read stands. */
  status: 'idle' | 'loading' | 'ready' | 'failed'
  /** What the deployment published, newest first; empty until a read succeeds. */
  announcements: readonly Announcement[]
}

/** Declared action shape giving the exported factory a stable return type. */
type AnnouncementsRowActions = {
  begin: (draft: AnnouncementsRowState) => void
  succeed: (draft: AnnouncementsRowState, announcements: readonly Announcement[]) => void
  fail: (draft: AnnouncementsRowState) => void
  reset: (draft: AnnouncementsRowState) => void
}

/**
 * Declares the announcements row state and write surface.
 * @returns the store handle.
 */
export function createAnnouncementsRowStore(): EngineStoreHandle<AnnouncementsRowState, AnnouncementsRowActions> {
  return defineStore({
    init: (): AnnouncementsRowState => ({ status: 'idle', announcements: [] }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, announcements: readonly Announcement[]) => {
        draft.status = 'ready'
        draft.announcements = announcements
      },
      // The reason is the transport's and a reader can only retry, so the row
      // keeps no message it could show them.
      fail: (draft) => { draft.status = 'failed' },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
    },
  })
}
