/**
 * The conversations this page lists, projected from the session catalog the
 * rest of the client already reads.
 *
 * Its own unit because the projection has two properties worth pinning and
 * neither is visible in a slot registration: the rows are the catalog's rows
 * rather than a second listing, and the snapshot is cached until the catalog
 * moves, which is what a `useSyncExternalStore` reader requires of a derived
 * source.
 *
 * @module @lyness/lyn-client-ui-settings-data/client/rows
 */

import type { ObservableSnapshot } from '@lyness/lyn-client-store'
import type { SessionListState, SessionSummary } from '@lyness/lyn-api-session-controller/client'

/** One conversation, as the data section shows it. */
export interface ConversationRow {
  /** The conversation's own id, which an export or a deletion names. */
  readonly id: string
  /** What the rest of the client calls it: its durable title, its project, or its id. */
  readonly title: string
  /** When it last moved, as the catalog reports it. */
  readonly updatedAt: number
}

/** The part of the session catalog this projection reads. */
export interface ConversationSource {
  /** The catalog's own snapshot source. */
  readonly list: ObservableSnapshot<SessionListState>
}

/**
 * Whether one catalog row is a conversation a person has.
 *
 * A blank row is the unused session a new-conversation gesture holds open; it
 * is not something anybody had. A subagent row is part of the conversation
 * that delegated to it — the export archives it there and the deletion
 * removes it there — so listing it separately would offer two controls over
 * one thing.
 * @param row - the catalog row.
 * @returns true when the row is a conversation of its own.
 */
function isConversation(row: SessionSummary): boolean {
  return !row.blank && row.origin !== 'subagent'
}

/**
 * Project the session catalog into the page's rows, newest first.
 *
 * @param source - the session catalog.
 * @returns rows that change identity only when the catalog does.
 */
export function conversationRows(source: ConversationSource): ObservableSnapshot<readonly ConversationRow[]> {
  let read: SessionListState | undefined
  let rows: readonly ConversationRow[] = []
  return {
    getSnapshot: () => {
      const state = source.list.getSnapshot()
      if (state === read) return rows
      read = state
      rows = state.ids
        .map(id => state.byId[id])
        .filter((row): row is SessionSummary => row !== undefined && isConversation(row))
        .map((row): ConversationRow => ({ id: String(row.id), title: row.displayTitle, updatedAt: row.updatedAt }))
        .sort((left, right) => right.updatedAt - left.updatedAt)
      return rows
    },
    subscribe: listener => source.list.subscribe(listener),
  }
}
