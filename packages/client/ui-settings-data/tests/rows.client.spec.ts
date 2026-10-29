/**
 * The rows this page lists: the session catalog's own rows, which are not
 * copied, re-sorted by recency, and cached until the catalog moves.
 */

import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@lyness/lyn-session/types'
import type { SessionListState, SessionSummary } from '@lyness/lyn-api-session-controller/client'
import { conversationRows } from '../src/client/rows.ts'

/** One catalog row. */
function row(id: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: SessionId(id),
    displayTitle: id,
    running: false,
    retainedBy: {},
    blank: false,
    updatedAt: 0,
    ...over,
  }
}

/** A catalog snapshot over the given rows, in the given order. */
function state(rows: readonly SessionSummary[]): SessionListState {
  return {
    ids: rows.map(one => one.id),
    byId: Object.fromEntries(rows.map(one => [one.id, one])),
    phase: 'ready',
    projectionsBySession: {},
  }
}

/** A catalog source a spec can advance. */
function catalog(initial: SessionListState) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    list: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    advance: (next: SessionListState) => {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    listeners,
  }
}

describe('conversationRows', () => {
  it('lists the catalog\'s conversations, newest first', () => {
    const source = catalog(state([
      row('older', { displayTitle: 'An older one', updatedAt: 100 }),
      row('newer', { displayTitle: 'A newer one', updatedAt: 200 }),
    ]))
    expect(conversationRows(source).getSnapshot()).toEqual([
      { id: 'newer', title: 'A newer one', updatedAt: 200 },
      { id: 'older', title: 'An older one', updatedAt: 100 },
    ])
  })

  it('leaves out a blank row and a subagent row', () => {
    // A blank is the unused session a new-conversation gesture holds open; a
    // subagent belongs to the conversation that delegated to it.
    const source = catalog(state([
      row('mine'),
      row('unused', { blank: true }),
      row('delegated', { origin: 'subagent' }),
    ]))
    expect(conversationRows(source).getSnapshot().map(one => one.id)).toEqual(['mine'])
  })

  it('leaves out an id the catalog lists without a row', () => {
    const source = catalog({ ...state([row('mine')]), ids: [SessionId('mine'), SessionId('ghost')] })
    expect(conversationRows(source).getSnapshot().map(one => one.id)).toEqual(['mine'])
  })

  it('answers the same array until the catalog moves', () => {
    // A derived source that minted a fresh array per read would make every
    // `useSyncExternalStore` reader re-render forever.
    const source = catalog(state([row('mine')]))
    const rows = conversationRows(source)
    expect(rows.getSnapshot()).toBe(rows.getSnapshot())
    const before = rows.getSnapshot()
    source.advance(state([row('mine'), row('another')]))
    expect(rows.getSnapshot()).not.toBe(before)
    expect(rows.getSnapshot().map(one => one.id)).toEqual(['mine', 'another'])
  })

  it('subscribes through the catalog and unsubscribes with its reader', () => {
    const source = catalog(state([row('mine')]))
    const listener = vi.fn()
    const stop = conversationRows(source).subscribe(listener)
    expect(source.listeners.size).toBe(1)
    source.advance(state([row('mine')]))
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    expect(source.listeners.size).toBe(0)
  })
})
