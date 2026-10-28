/**
 * Durable placement for organization budgets.
 *
 * Its own domain rather than a table beside the allowance overrides: the two
 * are set by different standings — a tenant administrator changes what its
 * members get, only a platform standing changes what the organization may
 * spend in total — and keeping them apart is what keeps one surface's save
 * away from the other's table.
 *
 * @module @lyness/lyn-credits/budget-storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { PersonId } from '@lyness/lyn-people'
import type { OrganizationBudget } from './budget.ts'

/** Stored budget; a ceiling of zero is a decision, so the amount may be zero. */
export const budgetSchema: z.ZodType<OrganizationBudget> = z.object({
  organization: z.string().min(1),
  periodicAmount: z.number().int().min(0).max(1_000_000_000),
  period: z.enum(['daily', 'weekly', 'monthly']),
  setAt: storedInstant(),
  setBy: storedId<PersonId>(),
}).strict()

/** Authoritative organization-budget storage, keyed by organization. */
export const budgetDomain = defineDomain({
  name: 'credit_budget',
  version: 1,
  tables: {
    budgets: domainTable<string, OrganizationBudget>(budgetSchema),
  },
})
