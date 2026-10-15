/**
 * Publish who the call in progress is, for the duration of that call.
 *
 * A model request carries a route and messages, not a person; an RPC carries
 * a bearer identity in a header or a cookie. This plugin turns the second into
 * the first, so anything that needs to know whose call it is — metering,
 * authorization, attribution — reads one place instead of re-parsing a header.
 *
 * It resolves and never refuses. The request scope runs after authentication,
 * host trust, and envelope decoding have all accepted the call, so it is not a
 * place to reject one; a call presenting no session, or a lapsed one, proceeds
 * with no principal and the operation that needs one refuses it. That keeps
 * the refusal where the requirement is, which is also where the reason can be
 * explained.
 *
 * @module @lyness/lyn-request-principal
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import { AsyncLocalStorage } from 'node:async_hooks'
import { brandString } from '@lyness/lyn-brand'
import type { ActingContext, PersonId } from '@lyness/lyn-people'
import type { AuthSessionId, SignedInSession } from '@lyness/lyn-auth-session'
import type {} from '@lyness/lyn-client-connection'

declare module '@lyness/cordis' {
  interface Context {
    /** Who the call in progress is; absent outside a call and for a call presenting no live session. */
    requestPrincipal: RequestPrincipal
  }
}

/** The signed-in person a call speaks for, and the context they act in. */
export interface Principal {
  /** The person the presented session belongs to. */
  readonly person: PersonId
  /** The context that session has in force. */
  readonly acting: ActingContext
}

/** Cookie a browser presents its identity session in. */
export const IDENTITY_COOKIE = 'lyn_identity'

/**
 * The bearer identity one request presents.
 *
 * Both forms are read because both callers exist: a browser holds a cookie,
 * while a desktop client or a script sends a header. Reading only one would
 * silently leave the other anonymous.
 * @param request - the HTTP request the call arrived on.
 * @returns the presented identity, or undefined when the request presents none.
 */
export function presentedSession(request: Request): AuthSessionId | undefined {
  const authorization = request.headers.get('authorization')
  const bearer = authorization === null ? undefined : /^Bearer\s+(\S+)$/iu.exec(authorization)?.[1]
  if (bearer !== undefined) return brandString<AuthSessionId>(bearer)
  const cookie = request.headers.get('cookie')
  if (cookie === null) return undefined
  for (const pair of cookie.split(';')) {
    const [name, ...rest] = pair.trim().split('=')
    if (name === IDENTITY_COOKIE && rest.length > 0) {
      const value = rest.join('=')
      if (value.length > 0) return brandString<AuthSessionId>(value)
    }
  }
  return undefined
}

/** Resolves and publishes the principal of the call in progress. */
export class RequestPrincipal extends Service {
  static inject = ['authSessions']

  private readonly store = new AsyncLocalStorage<Principal>()

  /**
   * @param ctx - context providing the session store and the connection.
   */
  constructor(ctx: Context) {
    super(ctx, 'requestPrincipal')
    ctx.inject(['connection'], (connectionCtx) => {
      connectionCtx.effect(() =>
        connectionCtx.connection.rpc.scope((request, run) => this.enter(request, run)))
    })
  }

  /**
   * Who the call in progress is.
   * @returns the principal, or undefined outside a call and for a call presenting no live session.
   */
  current(): Principal | undefined {
    return this.store.getStore()
  }

  /**
   * Resolve this request's principal, then run the call inside it.
   * @param request - the HTTP request the call arrived on.
   * @param run - the channel owner's dispatch.
   * @returns whatever the dispatch returned.
   */
  private async enter<T>(request: Request, run: () => Promise<T>): Promise<T> {
    const presented = presentedSession(request)
    if (presented === undefined) return run()
    const session = await this.read(presented)
    if (session === undefined) return run()
    return this.store.run({ person: session.person, acting: session.acting }, run)
  }

  /** Read one presented session, treating unknown and lapsed alike as anonymous. */
  private async read(id: AuthSessionId): Promise<SignedInSession | undefined> {
    try {
      return await this.ctx.authSessions.read(id)
    } catch {
      // Unknown and lapsed are the same answer here: this call speaks for
      // nobody. Refusing belongs to the operation that requires a principal.
      return undefined
    }
  }
}

export default RequestPrincipal
