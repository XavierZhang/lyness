/**
 * Vocabulary for a signed-in session and the context it holds.
 *
 * @module @lyness/lyn-auth-session/types
 */

import type { Branded } from '@lyness/lyn-brand'
import type { ActingContext, PersonId } from '@lyness/lyn-people'

/**
 * Opaque bearer identity of one signed-in session.
 *
 * Branded and opaque because it is a bearer credential: whoever holds it acts
 * as that person until it is revoked, so nothing should derive it, parse it,
 * or log it.
 */
export type AuthSessionId = Branded<'AuthSessionId'>

/**
 * One person's signed-in session.
 *
 * Signing in produces a session for the person, not for a standing. The
 * context in force is server-side state on this session, changed only by an
 * explicit switch, so it is never inferred from what the person happens to
 * belong to.
 */
export interface SignedInSession {
  /** Bearer identity of this session. */
  readonly id: AuthSessionId
  /** The person who signed in. */
  readonly person: PersonId
  /** The context currently in force for this session. */
  readonly acting: ActingContext
  /** When the session was established, as a UTC instant. */
  readonly establishedAt: string
  /** When it lapses, as a UTC instant; absent means it does not. */
  readonly expiresAt?: string | undefined
  /** How the person proved who they are, for an audit a deployment keeps. */
  readonly method: string
}

/** Why a session could not be read. */
export type SessionRefusal =
  /** No session carries that identity. */
  | 'session-unknown'
  /** The session existed and has lapsed. */
  | 'session-expired'
