/**
 * The instructions section's slot store.
 *
 * The plugin's own calls are the only writer; the section reads through
 * `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * @module @lyness/lyn-client-ui-settings-instructions/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'

/** Where the read stands. */
export type InstructionsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unowned'

/** What the last save answered. */
export type SaveOutcome =
  | { kind: 'saved' }
  | { kind: 'refused'; reason: string }

/** What the section renders. */
export interface InstructionsSectionState {
  /** Where the read stands. */
  status: InstructionsStatus
  /** The instructions the deployment holds, as the last read or save reported them. */
  saved: string
  /** When they were last saved; absent when none are saved. */
  writtenAt: string | undefined
  /** Largest text this deployment accepts; 0 before a read has answered. */
  maxChars: number
  /** True while a save is in flight. */
  working: boolean
  /** What the last save answered, so the editor reports its own outcome. */
  outcome: SaveOutcome | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type InstructionsSectionActions = {
  begin: (draft: InstructionsSectionState) => void
  succeed: (draft: InstructionsSectionState, view: InstructionsView) => void
  fail: (draft: InstructionsSectionState) => void
  reset: (draft: InstructionsSectionState) => void
  work: (draft: InstructionsSectionState) => void
  saved: (draft: InstructionsSectionState, view: InstructionsView) => void
  refused: (draft: InstructionsSectionState, reason: string) => void
}

/**
 * Declares the section state and write surface.
 * @returns the store handle.
 */
export function createInstructionsSectionStore(): EngineStoreHandle<InstructionsSectionState, InstructionsSectionActions> {
  return defineStore({
    init: (): InstructionsSectionState => ({
      status: 'idle',
      saved: '',
      writtenAt: undefined,
      maxChars: 0,
      working: false,
      outcome: undefined,
    }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      // A call that speaks for nobody is told apart from one that answered:
      // there is nothing to retry and nothing to edit, so the section says so
      // rather than offering an editor whose save would be refused.
      succeed: (draft, view: InstructionsView) => {
        draft.status = view.owned ? 'ready' : 'unowned'
        draft.saved = view.text
        draft.writtenAt = view.writtenAt
        draft.maxChars = view.maxChars
      },
      // The reason is the transport's and a reader can only retry, so the
      // section keeps no message it could show them.
      fail: (draft) => { draft.status = 'failed' },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft) => {
        draft.working = true
        draft.outcome = undefined
      },
      // The stored state is read back from the answer rather than from what
      // was sent, so the editor shows what was kept.
      saved: (draft, view: InstructionsView) => {
        draft.working = false
        draft.outcome = { kind: 'saved' }
        draft.saved = view.text
        draft.writtenAt = view.writtenAt
        draft.maxChars = view.maxChars
      },
      refused: (draft, reason: string) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason }
      },
    },
  })
}
