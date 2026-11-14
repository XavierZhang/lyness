/** Typed Agent fixtures whose Session header decides top-level or subagent origin. */
import type { Context } from '@lyness/cordis'
import type { Agent } from '@lyness/lyn-agent'
import { unsupportedInbox, unsupportedModel } from '@lyness/lyn-agent-loop-testkit'
import { SESSION_FORMAT_VERSION, Session, type SessionId } from '@lyness/lyn-session'
import { brandString } from '@lyness/lyn-brand'

/**
 * Build an Agent whose behavior beyond its identity, context and Session is unused.
 * @param ctx - context the Agent owns.
 * @param id - Session identity.
 * @param options - working directory and subagent origin.
 * @returns the Agent.
 */
export function agentFor(ctx: Context, id: string, options: { cwd?: string; subagent?: boolean } = {}): Agent {
  const sessionId = brandString<SessionId>(id)
  const session = Session.create(sessionId, [], {
    version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false,
    ...options.cwd === undefined ? {} : { cwd: options.cwd },
    ...options.subagent === true ? { origin: 'subagent' as const } : {},
  })
  return {
    id: sessionId, options: {}, session, model: unsupportedModel(), inbox: unsupportedInbox(), status: 'idle', ctx,
    send: () => {}, followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}
