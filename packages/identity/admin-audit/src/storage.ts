/**
 * Durable placement for the administrative trail.
 *
 * Its own domain rather than a table beside the records it describes: a
 * roster's tables hold what is true now and are rewritten in place, while
 * this one is only ever appended to. A trail that shared a domain with the
 * records it audits would be removed by the same administrator action that
 * made it worth keeping.
 *
 * @module @deepseek-ai/dsh-admin-audit/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@deepseek-ai/dsh-storage-domain'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import type { AuditEntry, AuditEntryId, AuditFieldChange } from './types.ts'

/** One stored field change. */
export const changeSchema: z.ZodType<AuditFieldChange> = z.object({
  field: z.string().min(1),
  before: z.string().optional(),
  after: z.string().optional(),
  truncated: z.boolean().optional(),
  redacted: z.boolean().optional(),
}).strict()

/** One stored entry. */
export const entrySchema: z.ZodType<AuditEntry> = z.object({
  id: storedId<AuditEntryId>(),
  at: storedInstant(),
  by: storedId<PersonId>(),
  standing: storedId<MembershipId>(),
  kind: z.string().min(1),
  subject: z.string().min(1),
  subjectName: z.string(),
  action: z.enum(['added', 'changed', 'removed']),
  organization: z.string().min(1).optional(),
  changes: z.array(changeSchema),
}).strict()

/** Authoritative storage for the administrative trail. */
export const adminAuditDomain = defineDomain({
  name: 'admin_audit',
  version: 1,
  tables: {
    entries: domainTable<AuditEntryId, AuditEntry>(entrySchema),
  },
})
