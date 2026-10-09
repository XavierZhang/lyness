/**
 * Durable memory types: the stored entry and its opaque identity.
 * @module @lyness/lyn-memory/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** Opaque identity of one stored memory, shown to the model so it can remove one. */
export type MemoryId = Branded<'MemoryId'>

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
}
