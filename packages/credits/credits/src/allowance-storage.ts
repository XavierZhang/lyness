/**
 * Durable placement for allowance overrides.
 *
 * A separate domain from the ledger because the two have different lifetimes:
 * grants and debits accumulate forever and are read per person, while an
 * override is one current decision that is replaced in place. Keeping them
 * apart also keeps a policy edit from touching the table a balance is read
 * from.
 *
 * @module @lyness/lyn-credits/allowance-storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { PersonId } from '@lyness/lyn-people'
import type { AllowanceRecord } from './allowance.ts'

/** Stored override; it states only the fields it changes. */
export const allowanceSchema: z.ZodType<AllowanceRecord> = z.object({
  organization: z.string().min(1).optional(),
  person: storedId<PersonId>().optional(),
  periodicAmount: z.number().int().min(0).max(10_000_000).optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  setAt: storedInstant(),
  setBy: storedId<PersonId>(),
}).strict()

/** Authoritative allowance-override storage. */
export const allowanceDomain = defineDomain({
  name: 'credit_allowance',
  version: 1,
  tables: {
    overrides: domainTable<string, AllowanceRecord>(allowanceSchema),
  },
})
