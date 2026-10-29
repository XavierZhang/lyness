/**
 * The ownership fold, on its own so a reader can have it without the writer's
 * dependencies.
 *
 * The plugin that writes the record needs the request principal, which
 * reaches the client transport; a consumer that only wants to know whose
 * conversation a session is needs none of that. Registrants of one projection
 * key share a single unit and are counted, so reading it here neither
 * duplicates the fold nor takes it from the plugin that writes the record.
 *
 * @module @lyness/lyn-session-ownership/projection
 */

import * as zod from 'zod'
import { storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import type { ProjectionDefinition } from '@lyness/lyn-session-projection'
import type { SessionOwnerRecord } from './types.ts'

/** The projection's stored state, for a reader validating what it folds back. */
export const ownerRecordSchema: zod.ZodType<SessionOwnerRecord | null> = zod.object({
  version: zod.number(),
  owner: storedId<PersonId>(),
  membership: storedId<MembershipId>().optional(),
  openedAt: storedInstant(),
}).strict().nullable()

/**
 * Fold the ownership event into the session's state.
 * @param state - the state so far.
 * @param event - one session event.
 * @returns the record once it has been written, otherwise the state unchanged.
 */
export function applyOwnerEvent(
  state: SessionOwnerRecord | null,
  event: { type: string; data: unknown },
): SessionOwnerRecord | null {
  return event.type === 'session/owner' ? event.data as SessionOwnerRecord : state
}

/** Whose conversation a session is, folded from its own log. */
export const ownerProjectionDefinition = {
  key: 'owner',
  stateVersion: 1,
  stateSchema: ownerRecordSchema,
  init: () => null,
  apply: applyOwnerEvent,
} satisfies ProjectionDefinition<'owner', SessionOwnerRecord | null>
