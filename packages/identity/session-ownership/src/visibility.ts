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
import type { Session, SessionHeader } from '@lyness/lyn-session'
import type { ProjectionHandle } from '@lyness/lyn-session-projection'
import type {} from '@lyness/lyn-session-projection-cache'
import type {} from '@lyness/lyn-request-principal'
import type { PersonId, Role } from '@lyness/lyn-people'
import type { SessionOwnerRecord } from './types.ts'
import { applyOwnerEvent, ownerOf, ownerProjectionDefinition } from './index.ts'

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
   * The owner projection's own registration.
   *
   * Registered here rather than read through the registry by key: a reader
   * holds the handle its own registration returned, and registration is
   * reference-counted, so this adds one reference beside the plugin's.
   */
  private owner: ProjectionHandle<SessionOwnerRecord | null> | undefined

  /**
   * @param ctx - context carrying the projections, the principal, and the directory.
   */
  constructor(ctx: Context) {
    super(ctx, 'sessionVisibility')
  }

  /** Hold the owner projection before any rule reads it. */
  async [Service.init](): Promise<void> {
    this.owner = await this.ctx.sessionProjections.register(ownerProjectionDefinition)
  }

  /**
   * Whose conversation one session is.
   *
   * This service owns the projection, so it answers for it: a consumer that
   * folded the key itself would carry a second copy of the fold.
   * @param session - the session to attribute.
   * @returns the record, or undefined for a session nobody is attributed to.
   */
  ownerOf(session: Session): SessionOwnerRecord | undefined {
    if (this.owner === undefined) {
      throw new Error('session-ownership: the owner projection is read only after this service has initialized')
    }
    return ownerOf(this.owner, session)
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
    return this.decide(this.ownerOf(session), session.header)
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
   * Whether the conversation one Agent runs in may read another.
   *
   * A tool call carries no request principal — an Agent is not a browser —
   * so what bounds it is the conversation it is running in: it reaches what
   * the person who opened that conversation could reach, and nothing else.
   * An Agent in a conversation nobody opened is the deployment's own and is
   * bounded by nothing here; an unattributed target is not the deployment
   * answering for itself, so no Agent reads one it does not descend from.
   * @param reader - the session the Agent is running in.
   * @param target - the session it wants to read.
   * @returns true when that conversation may read this one.
   */
  async mayReadFrom(reader: Session, target: SessionHeader): Promise<boolean> {
    const subject = this.ownerOf(reader)
    if (subject === undefined) return true
    return await this.attribution(this.ownerAt(target), target, subject.owner, 0) === 'mine'
  }

  /**
   * Keep only the conversations the call in progress may see.
   *
   * Every corpus-wide read filters through here, so a row one face hides is
   * hidden by all of them. A live session answers authoritatively from its
   * own projection and a cold one from the durable cache, which is the only
   * owner a listing can read without opening a log: a session opened moments
   * ago has no cached owner yet, and answering it from the cache would hide
   * it from the very person who opened it.
   * @param items - the rows to filter.
   * @param headerOf - the header each row is about.
   * @returns the rows this call may see, in their original order.
   */
  async listable<Row>(items: readonly Row[], headerOf: (row: Row) => SessionHeader): Promise<Row[]> {
    const kept: Row[] = []
    for (const row of items) {
      const header = headerOf(row)
      const live = this.ctx.sessions.get(header.id)
      if (await (live === undefined ? this.mayList(header) : this.mayRead(live))) kept.push(row)
    }
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

  /** What one session reads as, live where it is open and from the cache where it is not. */
  private ownerAt(header: SessionHeader): SessionOwnerRecord | undefined {
    const live = this.ctx.sessions.get(header.id)
    return live === undefined ? this.cachedOwner(header) : this.ownerOf(live)
  }

  /**
   * Whose conversation this one is, to the person asking.
   *
   * A subagent child carries no owner of its own and belongs to the
   * conversation that spawned it, so the walk follows the parent chain. It
   * is bounded: a lineage longer than {@link LINEAGE_LIMIT} is corrupt
   * rather than deep. A parent that is not open is not resumed to answer —
   * a child is looked at from inside its parent, which is open then.
   */
  private async attribution(
    owner: SessionOwnerRecord | undefined,
    header: SessionHeader | undefined,
    person: PersonId,
    depth: number,
  ): Promise<'mine' | 'theirs' | 'unattributed'> {
    if (owner !== undefined) return owner.owner === person ? 'mine' : 'theirs'
    const parent = header?.parentSession
    if (parent === undefined || depth >= LINEAGE_LIMIT) return 'unattributed'
    const live = this.ctx.sessions.get(parent)
    if (live === undefined) return 'unattributed'
    return this.attribution(this.ownerOf(live), live.header, person, depth + 1)
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
  ): Promise<boolean> {
    const principal = this.ctx.requestPrincipal.current()
    // No principal is no browser: the CLI, a subagent, and a scheduled
    // follow-up are the deployment acting on itself, not somebody reading
    // another person's conversation.
    if (principal === undefined) return true
    const verdict = await this.attribution(owner, header, principal.person, 0)
    if (verdict !== 'unattributed') return verdict === 'mine'
    // What nobody opened is the deployment's own, and a platform
    // administrator is the one standing that answers for it.
    return await this.role(principal.acting.membership) === 'platform-administrator'
  }

  /** The role this call acts in, when it names a standing the directory knows. */
  private async role(membership: Parameters<Context['people']['membership']>[0] | undefined): Promise<Role | undefined> {
    if (membership === undefined) return undefined
    return (await this.ctx.people.membership(membership))?.role
  }
}

export default SessionVisibility
