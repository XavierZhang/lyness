/**
 * Durable placement for the credit ledger.
 *
 * Grants and debits are stored rather than a running total, because the
 * ledger is what makes a refusal answerable: a balance a customer cannot
 * account for is a support case.
 *
 * @module @deepseek-ai/dsh-credits/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@deepseek-ai/dsh-storage-domain'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { CreditDebit, CreditGrant, DebitId, GrantId } from './types.ts'

/** Stored grant; a non-positive amount is a malformed record, not an empty grant. */
export const grantSchema: z.ZodType<Omit<CreditGrant, 'id'>> = z.object({
  person: storedId<PersonId>(),
  amount: z.number().positive(),
  grantedAt: storedInstant(),
  expiresAt: storedInstant().optional(),
  reason: z.enum(['periodic', 'administrator', 'purchase']),
  grantedBy: storedId<PersonId>().optional(),
}).strict()

/** Stored debit; every one names the session that spent it. */
export const debitSchema: z.ZodType<Omit<CreditDebit, 'id'>> = z.object({
  person: storedId<PersonId>(),
  amount: z.number().positive(),
  at: storedInstant(),
  session: z.string().min(1),
  organization: z.string().min(1).optional(),
}).strict()

/** Authoritative credit storage. */
export const creditsDomain = defineDomain({
  name: 'credits',
  version: 1,
  tables: {
    grants: domainTable<GrantId, Omit<CreditGrant, 'id'>>(grantSchema),
    debits: domainTable<DebitId, Omit<CreditDebit, 'id'>>(debitSchema),
  },
})
