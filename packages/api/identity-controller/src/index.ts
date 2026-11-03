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
 * for a directory's own page, the other clears a cookie — and `dsh-sign-in-http`
 * owns the routes. This namespace only tells a surface where they are.
 *
 * @module @deepseek-ai/dsh-api-identity-controller
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-request-principal'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import type {} from '@deepseek-ai/dsh-sign-in'
import { SIGN_OUT_PATH, START_PREFIX } from '@deepseek-ai/dsh-sign-in-http'
import type { ChannelOfferView, ViewerPersonView, ViewerStandingView, ViewerView } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
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
    }
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
    return {
      standing: {
        id: String(held.id),
        role: held.role,
        ...held.organization === undefined ? {} : { organization: held.organization },
      },
    }
  }
}
