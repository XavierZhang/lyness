/**
 * The console's own navigation state: which administration page is open.
 *
 * It is the shell's state rather than each page's, because the shell owns the
 * navigation column and renders exactly one page at a time. The selection is
 * kept per browser (`persist`), so an administrator who reloads the console
 * returns to the page they were on rather than to the first one in the list.
 *
 * @module @lyness/lyn-client-ui-admin-console/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'

/** What the console's shell renders. */
export interface AdminConsoleState {
  /**
   * The page the console shows, or undefined to show the first one offered.
   *
   * Undefined rather than a default id, because which pages exist is the
   * deployment's answer: an id written here would name a page a composition
   * may not mount.
   */
  activeId: string | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type AdminConsoleActions = {
  select: (draft: AdminConsoleState, id: string) => void
}

/**
 * Declare the console's navigation state and its one write.
 * @returns the store handle.
 */
export function createAdminConsoleStore(): EngineStoreHandle<AdminConsoleState, AdminConsoleActions> {
  return defineStore({
    init: (): AdminConsoleState => ({ activeId: undefined }),
    persist: 'admin-console',
    actions: {
      select: (draft, id: string) => { draft.activeId = id },
    },
  })
}
