/**
 * Which conversations one Workspace projection may name.
 *
 * A Workspace is a directory on the host, shared by everyone who can reach
 * it, while the conversations opened in it belong to the people who opened
 * them. The registry accounts every one of them to the Workspace, so a
 * projection sent as-is hands each signed-in member the identities of
 * everybody else's conversations — and the archive and pin sets are
 * registry-global, which hands over the rest.
 *
 * This is the one place that narrows those identities to what the call may
 * see. It reuses the Session corpus rather than a second rule: an id this
 * call cannot list is an id a Workspace frame does not name.
 *
 * @module @lyness/lyn-api-workspace-controller/src/visible-sessions
 */

import type { Context } from '@lyness/cordis'
import type { SessionId } from '@lyness/lyn-session/types'
import type {} from '@lyness/lyn-session-query'
import type {} from '@lyness/lyn-session-ownership/visibility'

/**
 * The conversations one call may name, or `undefined` where nothing filters.
 *
 * A deployment with no accounts mounts no visibility rule; there every
 * conversation is the deployment's own and the distinction does not exist,
 * so no corpus is read and every id is kept.
 */
export type VisibleSessions = ReadonlySet<SessionId> | undefined

/**
 * Read which conversations the call in progress may name.
 *
 * One corpus read answers for a whole frame, so a projection pays it once
 * rather than per Workspace; Workspace frames follow explicit commands —
 * create, rename, archive, pin, reorder — so they are rare enough for the
 * read to sit on the sending path.
 * @param ctx - Host context carrying the visibility rule and the Session corpus.
 * @param signal - optional cancellation for the corpus read.
 * @returns the ids this call may name, or undefined where no rule is mounted.
 */
export async function visibleSessions(ctx: Context, signal?: AbortSignal): Promise<VisibleSessions> {
  const visibility = ctx.get('sessionVisibility')
  if (visibility === undefined) return undefined
  const query = ctx.get('sessionQuery')
  if (query === undefined) {
    throw new Error(
      'a deployment that decides whose conversations are visible must compose sessionQuery: '
      + 'without the Session corpus a Workspace projection cannot tell whose conversations it names',
    )
  }
  const records = await query.listSessions(signal)
  const visible = await visibility.listable(records, record => record.header)
  return new Set(visible.map(record => record.header.id))
}

/**
 * Whether one command may name this conversation.
 *
 * A command names a Session by id, so what a projection hides a command
 * could still reach: archiving, pinning and reordering are writes on
 * somebody's conversation. Each caller refuses with the words it already
 * uses for a Session it cannot account for, so an invisible one is
 * indistinguishable from an absent one.
 * @param sessionId - the id the request named.
 * @param visible - what this call may name, as {@link visibleSessions} read it.
 * @returns true when the command may act on it.
 */
export function names(sessionId: SessionId, visible: VisibleSessions): boolean {
  return visible === undefined || visible.has(sessionId)
}

/**
 * Narrow one accounted id list to what the call may name.
 * @param ids - the ids the registry accounts, in their authoritative order.
 * @param visible - what this call may name, as {@link visibleSessions} read it.
 * @returns the kept ids, in their original order.
 */
export function keepVisible(ids: readonly SessionId[], visible: VisibleSessions): SessionId[] {
  return visible === undefined ? [...ids] : ids.filter(id => visible.has(id))
}
