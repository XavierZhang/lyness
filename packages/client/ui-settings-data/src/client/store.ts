/**
 * The data section's slot store: the deletion a reader is part way through,
 * and what the last one answered.
 *
 * The rows are not here. They come from the session catalog, which is already
 * a shared source every other surface reads; copying them into this store
 * would be the second answer this page exists not to give.
 *
 * @module @lyness/lyn-client-ui-settings-data/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'

/** What the section renders beside the rows. */
export interface DataSectionState {
  /**
   * The conversation whose deletion is one click from happening.
   *
   * The confirmation is a state rather than a dialog because the thing being
   * confirmed is the row the reader is looking at: the second click lands on
   * the same line as the first.
   */
  confirming: string | undefined
  /** The conversation a deletion is in flight for, so only its own row reports it. */
  deleting: string | undefined
  /** Why the last deletion was refused, when one was. */
  refused: string | undefined
  /** How many stored sessions the last deletion removed, when one succeeded. */
  removed: number | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type DataSectionActions = {
  confirm: (draft: DataSectionState, id: string) => void
  cancel: (draft: DataSectionState) => void
  work: (draft: DataSectionState, id: string) => void
  done: (draft: DataSectionState, removed: number) => void
  refused: (draft: DataSectionState, reason: string) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createDataSectionStore(): EngineStoreHandle<DataSectionState, DataSectionActions> {
  return defineStore({
    init: (): DataSectionState => ({
      confirming: undefined,
      deleting: undefined,
      refused: undefined,
      removed: undefined,
    }),
    actions: {
      // One row at a time: asking about a second conversation drops the first
      // question, so a confirmation can never be answered for a row the
      // reader is no longer looking at.
      confirm: (draft, id: string) => {
        draft.confirming = id
        draft.refused = undefined
        draft.removed = undefined
      },
      cancel: (draft) => { draft.confirming = undefined },
      work: (draft, id: string) => {
        draft.confirming = undefined
        draft.deleting = id
        draft.refused = undefined
        draft.removed = undefined
      },
      done: (draft, removed: number) => {
        draft.deleting = undefined
        draft.removed = removed
      },
      refused: (draft, reason: string) => {
        draft.deleting = undefined
        draft.refused = reason
      },
    },
  })
}
