/**
 * Durable memory types: the stored entry and its opaque identity.
 * @module @lyness/lyn-memory/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** Opaque identity of one stored memory, shown to the model so it can remove one. */
export type MemoryId = Branded<'MemoryId'>

/**
 * Whose memories one partition holds.
 *
 * Derived from the person, never taken from a caller: the same person must
 * reach the same partition whether their agent is remembering something or
 * they are reading the page, so one function owns the form.
 */
export type MemoryOwnerId = Branded<'MemoryOwnerId'>

/**
 * Key of one entry inside the personal table: the owner and the entry's own
 * id. The owner is in the key rather than in the record, so a stored memory
 * keeps the fields it always had.
 */
export type MemoryPartitionKey = Branded<'MemoryPartitionKey'>

/** Who a memory is for. `member` is the person who wrote it; `shared` was published to everyone. */
export type MemoryScope = 'member' | 'shared'

/** One remembered fact. */
export interface MemoryEntry {
  /** The remembered text, exactly as the explicit write supplied it. */
  readonly text: string
  /** Reach of this entry. */
  readonly scope: MemoryScope
  /** Canonical UTC instant the entry was written. */
  readonly writtenAt: string
}

/** A stored entry paired with its identity, as reads return it. */
export interface MemoryRecord extends MemoryEntry {
  /** The entry's opaque identity. */
  readonly id: MemoryId
  /**
   * Whose entry this is; absent for a `shared` entry and for one written
   * before this deployment recorded owners.
   */
  readonly owner?: MemoryOwnerId | undefined
}
