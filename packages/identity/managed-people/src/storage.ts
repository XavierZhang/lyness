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
import type { MembershipId, PersonId, Role } from '@lyness/lyn-people'
import type { BindingRecord, PersonRecord, StandingRecord } from './types.ts'

const role: z.ZodType<Role> = z.enum([...ROLES] as [Role, ...Role[]])

/** One standing a stored person holds. */
export const standingSchema: z.ZodType<StandingRecord> = z.object({
  id: storedId<MembershipId>(),
  role,
  organization: z.string().min(1).optional(),
  addedAt: storedInstant(),
  addedBy: storedId<PersonId>(),
}).strict()

/**
 * One stored person, in either generation.
 *
 * Both forms are accepted because both are on disk: version 1 wrote one
 * `role` per person, version 2 writes `standings`. A reader folds the first
 * into a one-entry list and the next write of that record replaces it, so no
 * pass over the store is needed and a record nobody touches stays as saved.
 */
export const personSchema: z.ZodType<PersonRecord> = z.object({
  id: storedId<PersonId>(),
  displayName: z.string().min(1),
  standings: z.array(standingSchema).min(1).optional(),
  role: role.optional(),
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
  // 2 stores a list of standings per person; 1 stored one role per person and
  // its records still read, so a deployment that upgrades keeps its roster
  // without a migration pass.
  version: 2,
  compatibleVersions: [1],
  tables: {
    people: domainTable<string, PersonRecord>(personSchema),
    bindings: domainTable<string, BindingRecord>(bindingSchema),
  },
})
