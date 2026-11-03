/**
 * The durable instructions domain. A malformed record rejects opening it, so
 * a corrupt store fails loudly instead of silently dropping what a person
 * wrote for their own agents.
 * @module @lyness/lyn-personal-instructions/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedInstant } from '@lyness/lyn-storage-domain'
import type { InstructionsEntry, InstructionsOwnerId } from './types.ts'

/**
 * Largest text the store accepts, in UTF-16 code units.
 *
 * It is a storage limit rather than a deployment preference: the record is
 * copied verbatim into every session the person opens, so a store that
 * accepted more than a reader could be shown would leave logs nobody can
 * read back. A deployment that wants a smaller ceiling sets `maxChars`.
 */
export const MAX_INSTRUCTIONS_CHARS = 20_000

/** Stored instructions; blank or oversized text is a malformed record, not empty instructions. */
export const instructionsEntrySchema: z.ZodType<InstructionsEntry> = z.object({
  text: z.string().min(1).max(MAX_INSTRUCTIONS_CHARS),
  writtenAt: storedInstant(),
}).strict()

/** Authoritative storage of what each person told their own agents. */
export const personalInstructionsDomain = defineDomain({
  name: 'personal_instructions', version: 1,
  tables: { instructions: domainTable<InstructionsOwnerId, InstructionsEntry>(instructionsEntrySchema) },
})
