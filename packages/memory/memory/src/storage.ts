/**
 * The durable memory domain. Malformed entries reject opening it, so a
 * corrupt store fails loudly instead of silently dropping what a person asked
 * the agent to remember.
 *
 * Two tables rather than one, because a memory has two reaches and only one
 * of them belongs to somebody: `shared` entries and every entry written
 * before this deployment knew who wrote it live in {@link SHARED_TABLE},
 * while an entry written for one person lives in {@link PERSONAL_TABLE} under
 * a key that names them. The partition carries the owner, so the stored
 * record keeps the fields it always had.
 *
 * @module @lyness/lyn-memory/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedInstant } from '@lyness/lyn-storage-domain'
import type { MemoryEntry, MemoryId, MemoryPartitionKey } from './types.ts'

/** Largest accepted entry, in UTF-16 code units. A memory is a fact, not a document. */
export const MAX_ENTRY_CHARS = 2048

/** Entries every reader of this deployment sees: `shared`, and everything written before owners were known. */
export const SHARED_TABLE = 'entries'

/** Entries written for one person, keyed by that person and the entry's own id. */
export const PERSONAL_TABLE = 'personal'

/** Stored entry; a blank or oversized text is a malformed record, not an empty memory. */
export const memoryEntrySchema: z.ZodType<MemoryEntry> = z.object({
  text: z.string().min(1).max(MAX_ENTRY_CHARS).refine(value => value.trim() === value, {
    message: 'Memory text must carry no leading or trailing whitespace',
  }),
  scope: z.enum(['member', 'shared']),
  writtenAt: storedInstant(),
}).strict()

/** Authoritative memory storage. */
export const memoryDomain = defineDomain({
  name: 'memory', version: 1,
  tables: {
    [SHARED_TABLE]: domainTable<MemoryId, MemoryEntry>(memoryEntrySchema),
    [PERSONAL_TABLE]: domainTable<MemoryPartitionKey, MemoryEntry>(memoryEntrySchema),
  },
})
