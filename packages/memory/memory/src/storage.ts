/**
 * The durable memory domain. Malformed entries reject opening it, so a
 * corrupt store fails loudly instead of silently dropping what a person asked
 * the agent to remember.
 * @module @lyness/lyn-memory/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@lyness/lyn-storage-domain'
import type { MemoryEntry, MemoryId } from './types.ts'

/** Largest accepted entry, in UTF-16 code units. A memory is a fact, not a document. */
export const MAX_ENTRY_CHARS = 2048

const instantSchema = z.iso.datetime({ precision: 3 }).refine(value => !value.startsWith('0000-'), {
  message: 'Expected a canonical four-digit-year UTC calendar instant',
})

/** Stored entry; a blank or oversized text is a malformed record, not an empty memory. */
export const memoryEntrySchema: z.ZodType<MemoryEntry> = z.object({
  text: z.string().min(1).max(MAX_ENTRY_CHARS).refine(value => value.trim() === value, {
    message: 'Memory text must carry no leading or trailing whitespace',
  }),
  scope: z.enum(['member', 'shared']),
  writtenAt: instantSchema,
}).strict()

/** Authoritative memory storage. */
export const memoryDomain = defineDomain({
  name: 'memory', version: 1,
  tables: { entries: domainTable<MemoryId, MemoryEntry>(memoryEntrySchema) },
})
