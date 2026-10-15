/**
 * Durable placement for signed-in sessions.
 *
 * @module @lyness/lyn-auth-session/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@lyness/lyn-storage-domain'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { AuthSessionId, SignedInSession } from './types.ts'

const instant = z.iso.datetime({ precision: 3 })

/** A branded identity as a stored string. */
function brandedId<T extends string>(): z.ZodType<T> {
  return z.custom<T>(value => typeof value === 'string' && value.length > 0, {
    message: 'Expected a non-empty opaque identity',
  })
}

/** Stored session; the acting context is stored as the two ids it is made of. */
export const sessionSchema: z.ZodType<Omit<SignedInSession, 'id'>> = z.object({
  person: brandedId<PersonId>(),
  acting: z.object({
    person: brandedId<PersonId>(),
    membership: brandedId<MembershipId>().optional(),
  }).strict(),
  establishedAt: instant,
  expiresAt: instant.optional(),
  method: z.string().min(1),
}).strict()

/** Authoritative session storage. */
export const sessionDomain = defineDomain({
  name: 'auth_session',
  version: 1,
  tables: { sessions: domainTable<AuthSessionId, Omit<SignedInSession, 'id'>>(sessionSchema) },
})
