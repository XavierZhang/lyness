/**
 * Durable placement for the bots an administrator maintains.
 *
 * Its own domain rather than a table beside the people: a person record is
 * what the admission table points at, and a table that can hold persona prose
 * is a table an administrator could attach prose to for a human. Keeping them
 * apart is what keeps a bot un-admittable and a colleague persona-less.
 *
 * @module @deepseek-ai/dsh-managed-bots/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@deepseek-ai/dsh-storage-domain'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { BotRecord, TeamRecord } from './types.ts'

/** One stored bot. */
export const botSchema: z.ZodType<BotRecord> = z.object({
  id: storedId<PersonId>(),
  displayName: z.string().min(1),
  organization: z.string().min(1),
  persona: z.string(),
  job: z.string(),
  preset: z.string().min(1),
  addedAt: storedInstant(),
  addedBy: storedId<PersonId>(),
}).strict()

/** One stored team. */
export const teamSchema: z.ZodType<TeamRecord> = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  organization: z.string().min(1),
  members: z.array(storedId<PersonId>()),
  addedAt: storedInstant(),
  addedBy: storedId<PersonId>(),
}).strict()

/** Authoritative storage for a runtime-maintained bot roster. */
export const managedBotsDomain = defineDomain({
  name: 'managed_bots',
  version: 1,
  // One version, not two: this domain is introduced with the teams table
  // beside the bots one, so no stored generation precedes either.
  tables: {
    bots: domainTable<string, BotRecord>(botSchema),
    teams: domainTable<string, TeamRecord>(teamSchema),
  },
})
