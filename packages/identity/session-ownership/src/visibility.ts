/**
 * Whose conversations one call may see.
 *
 * A session records who opened it; until something reads that record back,
 * every signed-in person can list and open everybody else's conversations.
 * This is the rule that reads it, and it lives beside the stamp so the two
 * cannot disagree about what attribution means.
 *
 * It answers for the call in progress rather than for a named person: outside
 * a request there is no principal, and an in-process caller — the CLI, a
 * subagent, a scheduled follow-up — is the deployment itself rather than
 * somebody browsing it.
 *
 * @module @lyness/lyn-session-ownership/visibility
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { Session, SessionHeader, SessionId } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-projection'
import type {} from '@lyness/lyn-session-projection-cache'
import type {} from '@lyness/lyn-request-principal'
import type { Role } from '@lyness/lyn-people'
import type { SessionOwnerRecord } from './types.ts'
import { applyOwnerEvent, ownerOf } from './index.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Whose conversations the call in progress may see; absent where a deployment has no accounts. */
    sessionVisibility: SessionVisibility
  }
}

/** Stable Cordis plugin name. */
export const name = 'session-visibility'

/**
 * How far a parent chain is walked for an unattributed session.
 *
 * Delegation depth is bounded far below this, so reaching it means the
 * lineage is corrupt rather than deep, and the session reads as the
 * deployment's own.
 */
const LINEAGE_LIMIT = 8

/** One event of an observed log, as this rule reads it. */
export interface ObservedEvent {
  /** The event's type tag. */
  readonly type: string
  /** The event's payload. */
  readonly data: unknown
}

/** One observed cut of a session, as a page, a follow, or a projection read holds it. */
export interface ObservedCut {
  /** Immutable identity metadata of the observed session. */
  readonly header: SessionHeader
  /** The observed events, oldest first. */
  readonly events: readonly ObservedEvent[]
}

/** Decide whether one call may see one conversation. */
export class SessionVisibility extends Service {
  static inject = ['sessionProjections', 'sessions', 'requestPrincipal', 'people']

  /**
   * @param ctx - context carrying the projections, the principal, and the directory.
   */
  constructor(ctx: Context) {
    super(ctx, 'sessionVisibility')
  }

  /**
   * Whether the call in progress may see one live conversation.
   *
   * Authoritative: the owner comes from the session's own log rather than
   * from a cache, so this is the answer an operation on one named session
   * acts on.
   * @param session - the session the call named.
   * @returns true when the call may see it.
   */
  mayRead(session: Session): Promise<boolean> {
    return this.decide(ownerOf(this.ctx, session), session.header)
  }

  /**
   * Whether the call in progress may see the conversation one observed cut
   * belongs to.
   *
   * Authoritative, for a read that never resumes an Agent: a live session
   * answers from its own projection, and a cold one from the events the
   * observation already holds, so the hot path never materializes a log to
   * find out who opened it.
   * @param observation - the cut a page, a follow, or a projection read holds.
   * @returns true when the call may see it.
   */
  mayReadObservation(observation: ObservedCut): Promise<boolean> {
    const live = this.ctx.sessions.get(observation.header.id)
    return live === undefined ? this.fromLog(observation.events, observation.header) : this.mayRead(live)
  }

  /**
   * Whether the call in progress may see one listed conversation.
   *
   * Cheap: the owner comes from the durable projection cache, because a
   * listing reads no logs. A row whose owner is not cached reads as
   * unattributed, which keeps a listing from leaking one and leaves the
   * authoritative answer to {@link mayRead} when somebody opens it.
   * @param header - the listed session's header.
   * @returns true when the call may see it.
   */
  mayList(header: SessionHeader): Promise<boolean> {
    return this.decide(this.cachedOwner(header), header)
  }

  /**
   * Keep only the conversations the call in progress may see.
   * @param items - the rows to filter.
   * @param headerOf - the header each row is about.
   * @returns the rows this call may see, in their original order.
   */
  async listable<Row>(items: readonly Row[], headerOf: (row: Row) => SessionHeader): Promise<Row[]> {
    const kept: Row[] = []
    for (const row of items) if (await this.mayList(headerOf(row))) kept.push(row)
    return kept
  }

  /** Attribution folded out of an observed log cut; written once, so the first one is the only one. */
  private fromLog(events: readonly ObservedEvent[], header: SessionHeader): Promise<boolean> {
    let owner: SessionOwnerRecord | null = null
    for (const event of events) {
      owner = applyOwnerEvent(owner, event)
      if (owner !== null) break
    }
    return this.decide(owner ?? undefined, header)
  }

  /** The attribution the durable cache holds for one listed session, if any. */
  private cachedOwner(header: SessionHeader): SessionOwnerRecord | undefined {
    const rows = this.ctx.get('sessionProjectionCache')?.cachedCheckpoint(header)
    return (rows === undefined ? undefined : this.ctx.sessionProjections.checkpointState(rows, 'owner')) ?? undefined
  }

  /**
   * Whether the call may see one session named only by its id.
   *
   * The parent of an unattributed child: resuming that parent to decide
   * whether its child may be shown would turn a read into an activation, so
   * only an open parent answers.
   * @param id - the parent this child names.
   * @param depth - how far the walk has already come.
   * @returns true when the call may see the conversation that lineage belongs to.
   */
  private whoseLineage(id: SessionId, depth: number): Promise<boolean> {
    const live = this.ctx.sessions.get(id)
    // A parent that is not open cannot be read without opening it, so the
    // child stays the deployment's own until the conversation it belongs to
    // is: a child is looked at from inside its parent, which is open then.
    if (live === undefined) return this.decide(undefined, undefined)
    return this.decide(ownerOf(this.ctx, live), live.header, depth)
  }

  /**
   * The one rule, applied to whatever attribution was read.
   *
   * A conversation belongs to the person who opened it, and to nobody else:
   * an administrator administers a deployment without reading its people's
   * conversations. An unattributed one — a scheduled run, an inbound webhook,
   * a session older than this rule — is the deployment's own, so only a
   * platform administrator can answer for it.
   */
  private async decide(
    owner: SessionOwnerRecord | undefined,
    header: SessionHeader | undefined,
    depth = 0,
  ): Promise<boolean> {
    const principal = this.ctx.requestPrincipal.current()
    // No principal is no browser: the CLI, a subagent, and a scheduled
    // follow-up are the deployment acting on itself, not somebody reading
    // another person's conversation.
    if (principal === undefined) return true
    if (owner !== undefined) return owner.owner === principal.person
    // A subagent child is opened by the loop rather than by a request, so it
    // carries no owner of its own and belongs to the conversation that
    // spawned it. The walk is bounded: a lineage longer than this is a
    // corrupt parent chain, and it reads as the deployment's own.
    const parent = header?.parentSession
    if (parent !== undefined && depth < LINEAGE_LIMIT) return this.whoseLineage(parent, depth + 1)
    return await this.role(principal.acting.membership) === 'platform-administrator'
  }

  /** The role this call acts in, when it names a standing the directory knows. */
  private async role(membership: Parameters<Context['people']['membership']>[0] | undefined): Promise<Role | undefined> {
    if (membership === undefined) return undefined
    return (await this.ctx.people.membership(membership))?.role
  }
}

export default SessionVisibility
