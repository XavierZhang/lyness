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
import type { Session } from '@lyness/lyn-session'
import type { ProjectionHandle } from '@lyness/lyn-session-projection'
import type {} from '@lyness/lyn-request-principal'
import { ownerProjectionDefinition } from './projection.ts'
import { SESSION_OWNER_RECORD_VERSION } from './types.ts'
import type { SessionOwnerRecord } from './types.ts'

export type { SessionOwnerRecord } from './types.ts'
export { SESSION_OWNER_RECORD_VERSION } from './types.ts'
export { applyOwnerEvent, ownerProjectionDefinition, ownerRecordSchema } from './projection.ts'

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

/** Stable Cordis plugin name. */
export const name = 'session-ownership'

/** The sessions this plugin stamps, the fold that reads the stamp back, and who the call speaks for. */
export const inject = ['sessionProjections', 'sessions', 'requestPrincipal']

/**
 * Stamp every session with the person who opened it.
 * @param ctx - plugin context carrying the sessions, the projection registry, and the principal.
 */
export async function apply(ctx: Context): Promise<void> {
  const owner = await ctx.sessionProjections.register(ownerProjectionDefinition)

  const stamp = (session: Session): void => {
    const state = owner.stateOf(session)
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
  // `session/created` is a read-only announcement: an append inside it is
  // refused, and a synchronous throw there vetoes the creation outright. The
  // stamp therefore runs on the microtask that follows the announcement, which
  // the contract names as the first point the Session accepts an event. Every
  // creation path awaits between the announcement and handing the session to a
  // caller, so the record is in the log before anybody reads attribution.
  ctx.on('session/created', (session) => { queueMicrotask(() => { stamp(session) }) })
  for (const session of ctx.sessions.list()) stamp(session)
}

/**
 * Whose conversation this is.
 * @param owner - the owner projection's registration, awaited by its reader.
 * @param session - the session to attribute.
 * @returns the record, or undefined for a session nobody is attributed to.
 */
export function ownerOf(
  owner: ProjectionHandle<SessionOwnerRecord | null>,
  session: Session,
): SessionOwnerRecord | undefined {
  return owner.stateOf(session) ?? undefined
}
