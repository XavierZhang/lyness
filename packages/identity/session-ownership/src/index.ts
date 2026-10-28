/**
 * A session belongs to the person who opened it.
 *
 * Nothing in a session recorded whose conversation it was. In a private
 * deployment that gap is invisible, because there is only one person; in the
 * hosted product one process serves many organizations, and a conversation
 * nobody is attributed to is one its organization cannot answer for.
 *
 * It is written once, at creation, and never rewritten: a session log is
 * released data, so attribution recorded wrongly would stay wrong, and
 * attribution added in two steps would cost two format changes instead of
 * one ([decision](../../../../.agents/notes/proposed/architecture/2026-10-07-session-ownership.md)).
 *
 * @module @lyness/lyn-session-ownership
 */

import type { Context } from '@lyness/cordis'
import * as zod from 'zod'
import type { Session } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-projection'
import type {} from '@lyness/lyn-request-principal'
import { storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import { SESSION_OWNER_RECORD_VERSION } from './types.ts'
import type { SessionOwnerRecord } from './types.ts'

export type { SessionOwnerRecord } from './types.ts'
export { SESSION_OWNER_RECORD_VERSION } from './types.ts'

declare module '@lyness/lyn-session/types' {
  interface SessionEventMap {
    /**
     * Records whose conversation this is: the person who opened it and the
     * standing they held it open under. Durable, log-only attribution that
     * stays out of the model transcript — the model is answering a person,
     * not reading their account.
     *
     * @param version - format of the record.
     * @param owner - the person who opened the conversation.
     * @param membership - the standing they held it open under; absent when acting as themselves.
     * @param openedAt - when it was opened, as a UTC instant.
     * @lynScopeScan unsupported
     */
    'session/owner': SessionOwnerRecord
  }
}

declare module '@lyness/lyn-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Whose conversation this is, or null before the record is written. */
    owner: SessionOwnerRecord | null
  }
}

const recordSchema: zod.ZodType<SessionOwnerRecord | null> = zod.object({
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

/** Stable Cordis plugin name. */
export const name = 'session-ownership'

/** The sessions this plugin stamps, the fold that reads the stamp back, and who the call speaks for. */
export const inject = ['sessionProjections', 'sessions', 'requestPrincipal']

/**
 * Stamp every session with the person who opened it.
 * @param ctx - plugin context carrying the sessions, the projection registry, and the principal.
 */
export function apply(ctx: Context): void {
  ctx.sessionProjections.register({
    key: 'owner',
    stateVersion: 1,
    stateSchema: recordSchema,
    init: () => null,
    apply: applyOwnerEvent,
  })

  const stamp = (session: Session): void => {
    const state = ctx.sessionProjections.stateOf(session, 'owner')
    /* v8 ignore next -- the projection is registered above; stateOf answers undefined only for an unregistered key. */
    if (state === undefined) throw new Error('session-ownership: the owner projection is not registered')
    if (state !== null) return
    // Read at stamp time: the principal published for the call that created
    // this session is the one that opened it.
    const principal = ctx.requestPrincipal.current()
    // A session opened by nobody is a real case — a CLI run, a subagent, an
    // inbound webhook — and it carries no owner rather than a placeholder
    // one. Attribution invented here would be wrong permanently.
    if (principal === undefined) return
    session.append('session/owner', {
      version: SESSION_OWNER_RECORD_VERSION,
      owner: principal.person,
      ...principal.acting.membership === undefined ? {} : { membership: principal.acting.membership },
      openedAt: new Date().toISOString(),
    })
  }
  ctx.on('session/created', stamp)
  for (const session of ctx.sessions.list()) stamp(session)
}

/**
 * Whose conversation this is.
 * @param ctx - a context with the projection registry mounted.
 * @param session - the session to attribute.
 * @returns the record, or undefined for a session nobody is attributed to.
 */
export function ownerOf(ctx: Context, session: Session): SessionOwnerRecord | undefined {
  // TODO(session-projection): read through the registration handle instead.
  // Upstream 0.2.1 deprecated the keyed read and types it `unknown`; the fold
  // state is parsed with the projection's own schema here, which is the same
  // validation the registry performs when it reloads a checkpoint.
  const state = ctx.sessionProjections.stateOf(session, 'owner')
  if (state === null || state === undefined) return undefined
  return recordSchema.parse(state) ?? undefined
}
