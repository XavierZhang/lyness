/**
 * Durable placement for configured sign-in channels.
 *
 * Its own domain because its lifetime is the deployment's rather than any
 * session's: a channel outlives every sign-in it performed, and a record whose
 * kind is momentarily absent from the composition must still be there when
 * that plugin comes back.
 *
 * @module @lyness/lyn-sign-in-channels/storage
 */

import { z } from 'zod'
import { defineDomain, domainTable, storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { PersonId } from '@lyness/lyn-people'
import type { ChannelRecord } from './types.ts'

/** One stored channel. */
export const channelSchema: z.ZodType<ChannelRecord> = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  displayName: z.string().min(1),
  organization: z.string().min(1).optional(),
  settings: z.record(z.string().min(1), z.string()),
  secret: z.string().min(1),
  configuredAt: storedInstant(),
  configuredBy: storedId<PersonId>(),
}).strict()

/** Authoritative configured-channel storage. */
export const channelDomain = defineDomain({
  name: 'sign_in_channels',
  version: 1,
  tables: {
    channels: domainTable<string, ChannelRecord>(channelSchema),
  },
})
