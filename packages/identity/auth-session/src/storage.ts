/**
 * Durable placement for signed-in sessions.
 *
 * @module @deepseek-ai/dsh-auth-session/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@deepseek-ai/dsh-storage-domain'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import type { AuthSessionId, SignedInSession } from './types.ts'

/** Stored session; the acting context is stored as the two ids it is made of. */
export const sessionSchema: z.ZodType<Omit<SignedInSession, 'id'>> = z.object({
  person: storedId<PersonId>(),
  acting: z.object({
    person: storedId<PersonId>(),
    membership: storedId<MembershipId>().optional(),
  }).strict(),
  establishedAt: storedInstant(),
  expiresAt: storedInstant().optional(),
  method: z.string().min(1),
}).strict()

/** Authoritative session storage. */
export const sessionDomain = defineDomain({
  name: 'auth_session',
  version: 1,
  tables: { sessions: domainTable<AuthSessionId, Omit<SignedInSession, 'id'>>(sessionSchema) },
})
