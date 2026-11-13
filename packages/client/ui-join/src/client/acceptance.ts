/**
 * Accepting an invitation as somebody the deployment already holds.
 *
 * Its own unit because the behaviour worth pinning is not the slot
 * registration: one acceptance at a time, a code that never leaves the page
 * until the person asks, and one answer for every refusal — this page shows
 * what the person gained or that they gained nothing, and never which rule
 * said no.
 *
 * @module @lyness/lyn-client-ui-join/client/acceptance
 */

import type { Context } from '@lyness/cordis'
import type { HostObservable } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-invitations-controller/remote'
import type { AcceptanceView, Role } from '@lyness/lyn-api-invitations-controller/types'

/** Where one acceptance has got to. */
export type AcceptanceStatus =
  /** Nothing asked for yet. */
  | 'idle'
  /** The call is in flight. */
  | 'working'
  /** The code granted this person a standing. */
  | 'accepted'
  /** The code grants this person nothing. */
  | 'nothing'
  /** The call itself broke, which is worth another try. */
  | 'failed'

/**
 * What the page renders for one acceptance.
 *
 * The granted standing is carried only by the one status that has it, so a
 * page cannot render a standing the deployment did not grant.
 */
export type AcceptanceRow =
  | { readonly status: Exclude<AcceptanceStatus, 'accepted'> }
  | {
    readonly status: 'accepted'
    /** What they now hold. */
    readonly role: Role
    /** The organization that standing is in; absent for a platform administrator. */
    readonly organization?: string
  }

/** Nothing asked for yet, as a constant so an unchanged row keeps its identity. */
export const IDLE: AcceptanceRow = { status: 'idle' }

/** The call is in flight. */
const WORKING: AcceptanceRow = { status: 'working' }

/** The code grants this person nothing. */
const NOTHING: AcceptanceRow = { status: 'nothing' }

/** The call broke. */
const FAILED: AcceptanceRow = { status: 'failed' }

/**
 * The row one answer renders as.
 *
 * Every refusal arrives as the same answer, so this reads one field: a page
 * that told a spent code from a wrong one would report which codes exist.
 * @param view - what the deployment answered.
 * @returns the row to publish.
 */
export function rowOf(view: AcceptanceView): AcceptanceRow {
  if (!view.accepted || view.role === undefined) return NOTHING
  return {
    status: 'accepted',
    role: view.role,
    ...view.organization === undefined ? {} : { organization: view.organization },
  }
}

/** One page's acceptance, and the state it publishes. */
export class Acceptance {
  /** What the page renders, as a snapshot source it subscribes to. */
  readonly state: HostObservable<AcceptanceRow>

  private readonly ctx: Context
  private readonly code: string | undefined
  private readonly listeners = new Set<() => void>()
  private row: AcceptanceRow = IDLE

  /**
   * @param ctx - client plugin context, where the invitations namespace is mounted.
   * @param code - the code this visit carries, if it carries one.
   */
  constructor(ctx: Context, code: string | undefined) {
    this.ctx = ctx
    this.code = code
    this.state = {
      getSnapshot: () => this.row,
      subscribe: (listener) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }
  }

  /**
   * Accept the code this visit carries.
   *
   * A second call while one is in flight does nothing: accepting twice would
   * spend a use of an invitation that already granted what it grants.
   */
  async accept(): Promise<void> {
    if (this.code === undefined || this.row.status === 'working') return
    this.publish(WORKING)
    const answered = await this.ctx.remote.invitations.accept(this.code)
    // A refusal is already an answer, carried as `accepted: false`; reaching
    // the other branch means the call itself did not land, which is the one
    // case worth another try.
    this.publish(answered.ok ? rowOf(answered.value) : FAILED)
  }

  /**
   * Publish one row to whoever is rendering.
   * @param row - the row to publish.
   */
  private publish(row: AcceptanceRow): void {
    this.row = row
    for (const listener of this.listeners) listener()
  }
}
