/**
 * Durable placement for an administrator-maintained allowance.
 *
 * A malformed record rejects opening the domain, so a corrupt store fails
 * loudly instead of silently serving an allowance nobody saved.
 *
 * @module @deepseek-ai/dsh-model-policy/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** One stored allowance: the models and the authority a refusal names. */
export interface StoredAllowance {
  /** Models an authorized user may use. */
  readonly allowed: readonly { readonly provider: string; readonly model: string }[]
  /** Who a refusal names. */
  readonly authority: string
}

/** Stored record; an empty list is malformed, because a saved allowance names at least one model. */
export const storedAllowanceSchema: z.ZodType<StoredAllowance> = z.object({
  allowed: z.array(z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
  }).strict()).min(1),
  authority: z.string().min(1),
}).strict()

/** Authoritative storage for the current allowance. */
export const allowanceDomain = defineDomain({
  name: 'model_policy',
  version: 1,
  tables: { allowance: domainTable<string, StoredAllowance>(storedAllowanceSchema) },
})
