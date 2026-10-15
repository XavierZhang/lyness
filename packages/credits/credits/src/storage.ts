/**
 * Durable placement for the credit ledger.
 *
 * Grants and debits are stored rather than a running total, because the
 * ledger is what makes a refusal answerable: a balance a customer cannot
 * account for is a support case.
 *
 * @module @lyness/lyn-credits/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@lyness/lyn-storage-domain'
import type { PersonId } from '@lyness/lyn-people'
import type { CreditDebit, CreditGrant, DebitId, GrantId } from './types.ts'

const instant = z.iso.datetime({ precision: 3 })

/**
 * A branded identity as a stored string.
 *
 * `z.custom` rather than `z.string()` because the brand is what the record
 * type requires, and the repository forbids casting through `unknown` to
 * pretend one is the other.
 */
function brandedId<T extends string>(): z.ZodType<T> {
  return z.custom<T>(value => typeof value === 'string' && value.length > 0, {
    message: 'Expected a non-empty opaque identity',
  })
}

/** Stored grant; a non-positive amount is a malformed record, not an empty grant. */
export const grantSchema: z.ZodType<Omit<CreditGrant, 'id'>> = z.object({
  person: brandedId<PersonId>(),
  amount: z.number().positive(),
  grantedAt: instant,
  expiresAt: instant.optional(),
  reason: z.enum(['periodic', 'administrator', 'purchase']),
  grantedBy: brandedId<PersonId>().optional(),
}).strict()

/** Stored debit; every one names the session that spent it. */
export const debitSchema: z.ZodType<Omit<CreditDebit, 'id'>> = z.object({
  person: brandedId<PersonId>(),
  amount: z.number().positive(),
  at: instant,
  session: z.string().min(1),
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
