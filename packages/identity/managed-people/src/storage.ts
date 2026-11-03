/**
 * Durable placement for the people and bindings an administrator maintains.
 *
 * Its own domain because its lifetime is the deployment's: a person outlives
 * every session they opened, and a binding outlives the channel record it
 * names, which an administrator may reconfigure without re-admitting anybody.
 *
 * @module @lyness/lyn-managed-people/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@lyness/lyn-storage-domain'
import { ROLES } from '@lyness/lyn-people'
import type { PersonId, Role } from '@lyness/lyn-people'
import type { BindingRecord, PersonRecord } from './types.ts'

const role: z.ZodType<Role> = z.enum([...ROLES] as [Role, ...Role[]])

/** One stored person. */
export const personSchema: z.ZodType<PersonRecord> = z.object({
  id: storedId<PersonId>(),
  displayName: z.string().min(1),
  role,
  organization: z.string().min(1).optional(),
  addedAt: storedInstant(),
  addedBy: storedId<PersonId>(),
}).strict()

/** One stored admission binding. */
export const bindingSchema: z.ZodType<BindingRecord> = z.object({
  channel: z.string().min(1),
  issuer: z.string().min(1),
  subject: z.string().min(1),
  person: storedId<PersonId>(),
  boundAt: storedInstant(),
  boundBy: storedId<PersonId>(),
}).strict()

/** Authoritative storage for a runtime-maintained directory. */
export const managedPeopleDomain = defineDomain({
  name: 'managed_people',
  version: 1,
  tables: {
    people: domainTable<string, PersonRecord>(personSchema),
    bindings: domainTable<string, BindingRecord>(bindingSchema),
  },
})
