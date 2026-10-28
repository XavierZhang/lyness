/**
 * Service Definition for signed-in sessions.
 *
 * Signing in produces a session for a person; which standing that session acts
 * in is server-side state on it, changed only by an explicit switch. That is
 * what lets one person hold several memberships without any call having to
 * guess which is in force.
 *
 * A session identity is a bearer credential. Reading one is therefore the only
 * way to learn who a caller is, and revoking one is the only way to stop them
 * — there is no second path that could disagree.
 *
 * @module @lyness/lyn-auth-session
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { ActingContext, PersonId } from '@lyness/lyn-people'
import type { AuthSessionId, SessionRefusal, SignedInSession } from './types.ts'

export type { AuthSessionId, SessionRefusal, SignedInSession } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Signed-in sessions; absent on a deployment that authenticates nobody. */
    authSessions: AuthSessionStore
  }
}

/** A session that could not be read, carrying the code a surface maps. */
export class SessionUnavailable extends Error {
  /** Stable machine code for the refusal. */
  readonly code: SessionRefusal

  /**
   * @param code - whether the session is unknown or has lapsed.
   */
  constructor(code: SessionRefusal) {
    super(code === 'session-expired' ? 'this session has expired' : 'no such session')
    this.name = 'SessionUnavailable'
    this.code = code
  }
}

/** What establishing a session needs. */
export interface EstablishRequest {
  /** The person who proved who they are. */
  readonly person: PersonId
  /** How they proved it, recorded on the session. */
  readonly method: string
  /** How long the session lasts, in milliseconds; absent means it does not lapse. */
  readonly lifetimeMs?: number | undefined
}

/**
 * Abstract store of signed-in sessions. Subclass and implement the four
 * operations for one source of truth; a deployment mounts exactly one.
 */
export abstract class AuthSessionStore extends Service {
  /**
   * @param ctx - the context this store serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'authSessions')
  }

  /**
   * Establish a session for a person who has just proved who they are.
   *
   * The session opens on that person's personal context rather than on a
   * membership, because opening on a standing would be the guess this design
   * exists to avoid — even when the person holds exactly one.
   * @param request - who signed in, how, and for how long.
   * @returns the established session.
   */
  abstract establish(request: EstablishRequest): Promise<SignedInSession>

  /**
   * Read one session by its bearer identity.
   * @param id - the bearer identity presented by a caller.
   * @returns the session.
   * @throws {SessionUnavailable} when no session carries that identity, or it has lapsed.
   */
  abstract read(id: AuthSessionId): Promise<SignedInSession>

  /**
   * Change the context one session acts in.
   *
   * The new context is checked before it is stored, so a session can never
   * hold a context its person may not act in — which would turn one bad
   * switch into every later call being wrong.
   * @param id - the session to change.
   * @param acting - the context to put in force, already checked.
   * @returns the session with its new context.
   * @throws {SessionUnavailable} when no session carries that identity, or it has lapsed.
   */
  abstract switchContext(id: AuthSessionId, acting: ActingContext): Promise<SignedInSession>

  /**
   * End one session.
   *
   * Ending a session ends the bearer credential, not the identity: the person
   * still exists and still holds every standing they held.
   * @param id - the session to end.
   * @returns true when a session was ended, false when none carried that identity.
   */
  abstract revoke(id: AuthSessionId): Promise<boolean>
}

export default AuthSessionStore
