/**
 * The invitations page's slot store.
 *
 * The plugin's own read is the only writer of the invitations; the page reads
 * through `props.useStore`. Keeping the read in the plugin rather than in the
 * component is what lets one in-flight read be shared by every open surface.
 *
 * The issued code lives here too, and only here: it is in the answer to the
 * call that issued it and nowhere else, so the page keeps it until the
 * administrator leaves and never reads it back.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-invitations/client/store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'

/** Where the read stands. */
export type InvitationsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable' | 'forbidden'

/** What one change answered. */
export type InvitationsOutcome =
  | { kind: 'issued'; label: string; code: string }
  | { kind: 'revoked' }
  | { kind: 'refused'; reason: string; fields: readonly string[] }

/** What the page renders. */
export interface InvitationsPageState {
  /** Where the read stands. */
  status: InvitationsStatus
  /** The invitations the caller administers, newest first. */
  invitations: readonly InvitationRowView[]
  /** True while a change is in flight. */
  working: boolean
  /** What the last change answered, so the form reports its own outcome. */
  outcome: InvitationsOutcome | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type InvitationsPageActions = {
  begin: (draft: InvitationsPageState) => void
  succeed: (draft: InvitationsPageState, invitations: readonly InvitationRowView[]) => void
  fail: (draft: InvitationsPageState, status: 'failed' | 'unavailable' | 'forbidden') => void
  reset: (draft: InvitationsPageState) => void
  work: (draft: InvitationsPageState) => void
  issued: (draft: InvitationsPageState, invitation: InvitationRowView) => void
  revoked: (draft: InvitationsPageState, id: string) => void
  refused: (draft: InvitationsPageState, refusal: { reason: string; fields: readonly string[] }) => void
}

/**
 * Declares the page state and write surface.
 * @returns the store handle.
 */
export function createInvitationsPageStore(): EngineStoreHandle<InvitationsPageState, InvitationsPageActions> {
  return defineStore({
    init: (): InvitationsPageState => ({
      status: 'idle',
      invitations: [],
      working: false,
      outcome: undefined,
    }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, invitations: readonly InvitationRowView[]) => {
        draft.status = 'ready'
        draft.invitations = invitations
      },
      // Three answers, not one: a deployment that issues no invitations has
      // nothing to retry, a caller who may not issue them has nothing to
      // retry either, and only a read that broke does.
      fail: (draft, status: 'failed' | 'unavailable' | 'forbidden') => { draft.status = status },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft) => {
        draft.working = true
        draft.outcome = undefined
      },
      issued: (draft, invitation: InvitationRowView) => {
        draft.working = false
        // The code is carried in the outcome rather than in the row: the row
        // is what the next read answers, and that read never carries it.
        draft.outcome = invitation.code === undefined
          ? undefined
          : { kind: 'issued', label: invitation.label, code: invitation.code }
        const { code: _issued, ...row } = invitation
        draft.invitations = [row, ...draft.invitations]
      },
      revoked: (draft, id: string) => {
        draft.working = false
        draft.outcome = { kind: 'revoked' }
        // Withdrawn, not removed: the row stays and stops being open, which
        // is what the deployment itself answers on the next read.
        draft.invitations = draft.invitations.map(one => one.id === id ? { ...one, open: false } : one)
      },
      refused: (draft, refusal: { reason: string; fields: readonly string[] }) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason: refusal.reason, fields: refusal.fields }
      },
    },
  })
}
