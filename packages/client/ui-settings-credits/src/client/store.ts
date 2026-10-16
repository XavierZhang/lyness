/**
 * The credits section's slot store.
 *
 * The plugin's own read is the only writer of the account; the section and the
 * reader read through `props.useStore`. Keeping the read in the plugin rather
 * than in the component is what lets one in-flight read be shared by every
 * open surface.
 *
 * @module @lyness/lyn-client-ui-settings-credits/client/store
 */

import { defineStore } from '@lyness/lyn-client-store'
import type { EngineStoreHandle } from '@lyness/lyn-client-store'
import type { AllowanceView, CreditAccountView } from '@lyness/lyn-api-credits-controller/types'

/** Where a read or a change stands. */
export type CreditsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable'

/** What the section renders. */
export interface CreditsSectionState {
  /** Where the account read stands. */
  status: CreditsStatus
  /** The calling person's account; absent until a read succeeds. */
  account: CreditAccountView | undefined
  /** The allowance the administrator last read or saved; absent until one is. */
  allowance: AllowanceView | undefined
  /** True while a grant or an allowance save is in flight. */
  working: boolean
  /** What the last change answered, so the form reports its own outcome. */
  outcome: { kind: 'granted'; person: string; amount: number } | { kind: 'allowance' } | { kind: 'refused'; reason: string } | undefined
}

/** Declared action shape giving the exported factory a stable return type. */
type CreditsSectionActions = {
  begin: (draft: CreditsSectionState) => void
  succeed: (draft: CreditsSectionState, account: CreditAccountView) => void
  fail: (draft: CreditsSectionState, status: 'failed' | 'unavailable') => void
  reset: (draft: CreditsSectionState) => void
  work: (draft: CreditsSectionState) => void
  granted: (draft: CreditsSectionState, outcome: { account: CreditAccountView; person: string; amount: number }) => void
  allowed: (draft: CreditsSectionState, allowance: AllowanceView) => void
  refused: (draft: CreditsSectionState, reason: string) => void
}

/**
 * Declares the credits section state and write surface.
 * @returns the store handle.
 */
export function createCreditsSectionStore(): EngineStoreHandle<CreditsSectionState, CreditsSectionActions> {
  return defineStore({
    init: (): CreditsSectionState => ({
      status: 'idle',
      account: undefined,
      allowance: undefined,
      working: false,
      outcome: undefined,
    }),
    actions: {
      begin: (draft) => { draft.status = 'loading' },
      succeed: (draft, account: CreditAccountView) => {
        draft.status = 'ready'
        draft.account = account
      },
      // A deployment that meters nothing is a different answer from a read
      // that broke: the first has no retry worth offering.
      fail: (draft, status: 'failed' | 'unavailable') => { draft.status = status },
      // Dropped before a retry, so a reader sees the attempt rather than a
      // stale failure that may or may not still hold.
      reset: (draft) => { draft.status = 'idle' },
      work: (draft) => {
        draft.working = true
        draft.outcome = undefined
      },
      granted: (draft, outcome: { account: CreditAccountView; person: string; amount: number }) => {
        draft.working = false
        draft.outcome = { kind: 'granted', person: outcome.person, amount: outcome.amount }
        // The answer is the granted person's account, which is the caller's own
        // only when they granted to themselves; replacing it otherwise would
        // show somebody else's balance as this account's.
        if (outcome.person === draft.account?.person) draft.account = outcome.account
      },
      allowed: (draft, allowance: AllowanceView) => {
        draft.working = false
        draft.outcome = { kind: 'allowance' }
        draft.allowance = allowance
      },
      refused: (draft, reason: string) => {
        draft.working = false
        draft.outcome = { kind: 'refused', reason }
      },
    },
  })
}
