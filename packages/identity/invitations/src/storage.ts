/**
 * Durable placement for the invitations an administrator has issued.
 *
 * Its own domain because its lifetime is neither a session's nor a person's:
 * an invitation outlives the browser that was sent it and dies on its own
 * expiry, and the trail of who issued what must survive the person who
 * redeemed it being removed again.
 *
 * The code is stored as a hash. A store that held the codes themselves would
 * be a store of live credentials for joining the deployment.
 *
 * @module @lyness/lyn-invitations/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@lyness/lyn-storage-domain'
import { ROLES } from '@lyness/lyn-people'
import type { MembershipId, PersonId, Role } from '@lyness/lyn-people'
import type { InvitationId, InvitationRecord } from './types.ts'

const role: z.ZodType<Role> = z.enum([...ROLES] as [Role, ...Role[]])

/** One stored invitation. */
export const invitationSchema: z.ZodType<InvitationRecord> = z.object({
  id: storedId<InvitationId>(),
  codeHash: z.string().min(1),
  label: z.string().min(1),
  role,
  organization: z.string().min(1).optional(),
  issuedBy: storedId<PersonId>(),
  issuedIn: storedId<MembershipId>(),
  issuedAt: storedInstant(),
  expiresAt: storedInstant(),
  maxUses: z.number().int().positive(),
  uses: z.number().int().nonnegative(),
  revokedAt: storedInstant().optional(),
}).strict()

/** Authoritative storage for issued invitations. */
export const invitationsDomain = defineDomain({
  name: 'invitations',
  version: 1,
  tables: {
    invitations: domainTable<string, InvitationRecord>(invitationSchema),
  },
})
