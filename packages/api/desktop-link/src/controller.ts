/**
 * The Remote surface a desktop attaches to.
 *
 * One stream per desktop, in both directions: the Host yields the work it
 * wants done, and the desktop answers on the same logical stream's uplink.
 * The call speaks for a signed-in person, so the link it opens is that
 * person's — a desktop cannot attach as someone else, because the principal
 * comes from the session it presented rather than from anything it sends.
 *
 * @module @lyness/lyn-desktop-link/controller
 */

import { Context } from '@lyness/cordis'
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type { RemoteStream } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-request-principal'
import type {} from './index.ts'
import type { DesktopReply, DesktopRequest } from './types.ts'

/** Message an unauthenticated attach is refused with. */
export const NOT_SIGNED_IN = 'desktop-link: attaching a desktop requires a signed-in call'

/** Message an attach outside a Remote call is refused with. */
export const NOT_A_REMOTE_CALL = 'desktop-link: attach runs only as a Remote stream'

/** The link a desktop opens, and the work it receives on it. */
export class DesktopLinkController extends TypertRemoteService {
  static inject = ['desktopLink', 'requestPrincipal']

  /** @param ctx - Host with the link and the request principal mounted. */
  constructor(ctx: Context) { super(ctx, 'desktopLinkController', { namespace: 'desktopLink', requires: 'member' }) }

  /**
   * Attach this desktop as its person's executor.
   *
   * @param signal - ends the link when the carrier does.
   * @returns the work this desktop should perform, until the stream ends.
   * @throws {Error} when the call speaks for nobody, or runs outside a Remote call.
   */
  @Remote({ mode: 'stream' })
  async *attach(signal: AbortSignal): RemoteStream<DesktopRequest, DesktopReply> {
    const principal = this.ctx.requestPrincipal.current()
    if (principal === undefined) throw new Error(NOT_SIGNED_IN)
    const invocation = this.ctx.invocation
    if (invocation === undefined) throw new Error(NOT_A_REMOTE_CALL)
    yield* this.ctx.desktopLink.serve(principal.person, invocation.uplink<DesktopReply>(), signal)
  }
}

export default DesktopLinkController
