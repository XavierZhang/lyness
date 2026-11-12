/**
 * Host Remote owner of the `identity` namespace: who the caller is, and what
 * this deployment would let them sign in with.
 *
 * It is readable by anyone, because the one caller who needs it most has
 * presented no identity yet: a surface cannot render a sign-in screen without
 * first asking whether this deployment has accounts and which channels it
 * mounts.
 *
 * Signing in and out are not here. Both are browser navigations — one leaves
 * for a directory's own page, the other clears a cookie — and `lyn-sign-in-http`
 * owns the routes. This namespace only tells a surface where they are.
 *
 * @module @lyness/lyn-api-identity-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-request-principal'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-auth-session'
import type {} from '@lyness/lyn-sign-in'
import { SIGN_OUT_PATH, START_PREFIX } from '@lyness/lyn-sign-in-http'
import type { ChannelOfferView, ViewerPersonView, ViewerStandingView, ViewerView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `identity` Remote namespace. */
    identityController: IdentityController
  }
}

/** Host service backing the generated `ctx.remote.identity` namespace. */
export default class IdentityController extends TypertRemoteService {
  /**
   * Register the identity namespace.
   * @param ctx - Host context where the request principal, the directory, and the sign-in registry may be mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'identityController', { namespace: 'identity', requires: 'anyone' })
  }

  /**
   * Describe the caller and what they may sign in with.
   * @returns whether this deployment has accounts, who the caller is, and the channels it offers.
   */
  @Remote
  async viewer(): Promise<ViewerView> {
    const principal = this.ctx.get('requestPrincipal')?.current()
    const signIn = this.ctx.get('signIn')
    return {
      // Accounts exist when a request can carry a principal at all. A
      // deployment that mounts the registry without the principal could never
      // act on who signed in, so the principal is the fact that decides it.
      accounts: this.ctx.get('requestPrincipal') !== undefined,
      channels: (signIn?.available() ?? []).map(channel => ({
        id: String(channel.id),
        displayName: channel.displayName,
        redirect: channel.kind === 'redirect',
      }) satisfies ChannelOfferView),
      signInPrefix: START_PREFIX,
      signOutPath: SIGN_OUT_PATH,
      ...await this.who(principal?.person),
      ...await this.standing(principal?.acting.membership),
      standings: await this.held(principal?.person),
    }
  }

  /**
   * Act in one of the standings this caller holds, and answer what they are
   * afterwards.
   *
   * One call changes one session's own acting context: the session is the one
   * this call presented, and the standing must be one its person holds. A
   * person who holds several starts personal — which organization they are
   * acting for is their decision — and this is where they make it.
   * @param standing - the standing to put in force.
   * @returns the viewer as the deployment now reads them.
   * @throws {RemoteError} `identity/no-identity` when the call presented none,
   * `identity/not-held` when the caller does not hold that standing, or
   * `gateway/internal` when this deployment keeps no sessions.
   */
  @Remote
  async act(standing: string): Promise<ViewerView> {
    const principal = this.ctx.get('requestPrincipal')?.current()
    if (principal === undefined) {
      throw new RemoteError('identity/no-identity', 'this call presented no identity', {})
    }
    const sessions = this.ctx.get('authSessions')
    if (sessions === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment keeps no sessions', { endpoint: 'identity' })
    }
    const wanted = brandString<MembershipId>(standing)
    const held = await this.ctx.get('people')?.memberships(principal.person) ?? []
    if (!held.some(candidate => candidate.id === wanted)) {
      throw new RemoteError('identity/not-held', 'this caller does not hold that standing', {})
    }
    await sessions.switchContext(principal.session, { person: principal.person, membership: wanted })
    return await this.viewer()
  }

  /** Every standing this person holds, as a surface offers them. */
  private async held(person: PersonId | undefined): Promise<readonly ViewerStandingView[]> {
    if (person === undefined) return []
    const held = await this.ctx.get('people')?.memberships(person) ?? []
    return held.map(one => view(one))
  }

  /** The person this call speaks for, when the directory knows them. */
  private async who(id: PersonId | undefined): Promise<{ person?: ViewerPersonView }> {
    if (id === undefined) return {}
    const found = await this.ctx.get('people')?.person(id)
    // A principal the directory no longer holds reads as signed out rather
    // than as a person with no name: the session outlived the record.
    return found === undefined ? {} : { person: { id: String(found.id), displayName: found.displayName } }
  }

  /** The standing this call acts in, when it names one the directory knows. */
  private async standing(id: MembershipId | undefined): Promise<{ standing?: ViewerStandingView }> {
    if (id === undefined) return {}
    const held = await this.ctx.get('people')?.membership(id)
    if (held === undefined) return {}
    return { standing: view(held) }
  }
}

/**
 * One standing as a surface shows it.
 * @param held - the standing as the directory holds it.
 * @returns its wire view.
 */
function view(held: Membership): ViewerStandingView {
  return {
    id: String(held.id),
    role: held.role,
    ...held.organization === undefined ? {} : { organization: held.organization },
  }
}
