/**
 * Sign a person in through an external directory, and hand back a session.
 *
 * One service holds both halves because they are one operation with one
 * answer. A channel verifies who someone is at their directory; the admission
 * rule says who that is here; a session is established for that person. A
 * surface that could run the first half alone would hold a verified subject
 * with no decision attached, which is exactly the state that invites treating
 * authentication as authorization.
 *
 * Channels register; they are not configured here. A deployment offering both
 * a Microsoft directory and a WeCom one mounts two channel plugins, and
 * neither this service nor a sign-in page learns anything channel-specific —
 * that is what lets an unsupported directory arrive as a plugin rather than as
 * a change here.
 *
 * @module @lyness/lyn-sign-in
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import type { AuthSessionId } from '@lyness/lyn-auth-session'
import type {
  ChannelDescription, ChannelId, ExternalSubject, RedirectStart, SignInOutcome, SignInRefusal,
} from './types.ts'

export type {
  ChannelDescription, ChannelId, ChannelKind, ExternalSubject, RedirectStart, SignInOutcome,
  SignInRefusal,
} from './types.ts'
export { SignInAdmission } from './admission.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Sign-in through an external directory; absent on a deployment with no directory. */
    signIn: SignIn
  }
}

/**
 * Brand a channel id a channel plugin or composition config states.
 * @param value - the channel's own name for itself.
 * @returns that name as a channel id.
 */
export function channelId(value: string): ChannelId {
  return brandString<ChannelId>(value)
}

/** A sign-in that produced no session, carrying the code a surface maps. */
export class SignInRefused extends Error {
  /** Stable machine code for the refusal. */
  readonly code: SignInRefusal

  /**
   * @param code - which of the three refusals this is.
   */
  constructor(code: SignInRefusal) {
    super(MESSAGES[code])
    this.name = 'SignInRefused'
    this.code = code
  }
}

const MESSAGES: Record<SignInRefusal, string> = {
  'channel-unknown': 'no such sign-in channel',
  'not-authenticated': 'the directory did not complete the sign-in',
  // One message for two causes, matching the single answer the admission rule
  // gives: telling an unauthenticated caller which addresses this deployment
  // knows would answer a question they are not entitled to ask.
  'not-admitted': 'this account may not use this deployment',
  'nothing-to-resume': 'this channel completes its own sign-in',
}

/** How long a session established by a directory sign-in lasts, in milliseconds. */
export const DEFAULT_LIFETIME_MS = 43_200_000

/** Deployment-owned terms for a session a directory sign-in establishes. */
export interface Config {
  /**
   * How long such a session lasts, in milliseconds. Defaults to twelve hours.
   *
   * A customer whose staff share machines shortens it; one issuing company
   * laptops lengthens it. Neither is a default this package can pick for them.
   */
  lifetimeMs?: number
}

export const Config: z<Config> = z.object({
  lifetimeMs: z.number().step(1).min(60_000).max(2_592_000_000).default(DEFAULT_LIFETIME_MS),
})

/** Resolved terms, with every default applied. */
export interface ResolvedConfig {
  /** How long a session established here lasts, in milliseconds. */
  readonly lifetimeMs: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the terms this service runs on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return { lifetimeMs: config.lifetimeMs ?? DEFAULT_LIFETIME_MS }
}

/**
 * A channel that owns its own browser round trip and returns when it is done.
 *
 * This is the desktop and CLI shape: the channel opens a window, waits on a
 * loopback callback, and has an answer by the time it returns.
 */
export interface SelfDrivenChannel extends ChannelDescription {
  /** Distinguishes the two shapes. */
  readonly kind: 'self-driven'

  /**
   * Run one sign-in against the directory.
   * @returns the verified subject, or undefined when the person did not complete it.
   */
  authenticate(): Promise<ExternalSubject | undefined>
}

/**
 * A channel the browser leaves for and comes back from.
 *
 * This is the hosted web shape, and it is two requests rather than one call:
 * the first says where to send the person, the second is the directory
 * returning them. A channel contract that had only the self-driven shape
 * would work for the client and not for the web app.
 */
export interface RedirectChannel extends ChannelDescription {
  /** Distinguishes the two shapes. */
  readonly kind: 'redirect'

  /**
   * Begin one sign-in.
   * @param returnTo - the deployment's own callback address the directory returns to.
   * @returns where to send the browser, and the attempt it belongs to.
   */
  start(returnTo: string): Promise<RedirectStart>

  /**
   * Finish the sign-in the directory is returning from.
   * @param parameters - the query the directory came back with.
   * @returns the verified subject, or undefined when the return does not complete a sign-in.
   */
  complete(parameters: URLSearchParams): Promise<ExternalSubject | undefined>
}

/** One mounted sign-in channel, in either shape. */
export type SignInChannel = SelfDrivenChannel | RedirectChannel

/**
 * The channels a deployment offers, and the sign-in they perform.
 *
 * Sessions and the admission rule are injected rather than read optionally:
 * without either, a sign-in has nowhere to put its result or no rule for who
 * may have one, and in both cases the right behaviour is to offer no sign-in
 * at all rather than one that admits everybody.
 */
export class SignIn extends Service {
  static inject = ['authSessions', 'signInAdmission']

  private readonly channels = new Map<ChannelId, SignInChannel>()

  private readonly terms: ResolvedConfig

  /**
   * @param ctx - context providing the session store and the admission rule.
   * @param config - validated session terms.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'signIn')
    this.terms = resolveConfig(config)
  }

  /**
   * Offer one channel as a sign-in option.
   *
   * Two channels of one id is a composition mistake rather than a runtime
   * condition — a sign-in page would show two identical buttons leading to
   * different directories — so it fails at registration.
   * @param channel - the channel to offer.
   * @returns the disposer; the registering plugin owns it.
   * @throws {Error} when a channel of that id is already registered.
   */
  register(channel: SignInChannel): () => Promise<void> {
    if (this.channels.has(channel.id)) {
      throw new Error(`sign-in: channel "${channel.id}" is already registered`)
    }
    return this.ctx.effect(() => {
      this.channels.set(channel.id, channel)
      return () => {
        this.channels.delete(channel.id)
      }
    }, 'signIn.register()')
  }

  /**
   * The channels a surface may offer, in registration order.
   * @returns each mounted channel's id and display name.
   */
  available(): readonly ChannelDescription[] {
    return [...this.channels.values()].map(({ id, displayName, kind }) => ({ id, displayName, kind }))
  }

  /**
   * Begin a sign-in through one channel.
   *
   * A self-driven channel has a session by the time this returns; a redirect
   * channel has only said where to send the browser, and {@link resume}
   * finishes it. Both shapes reach the same admission and the same session,
   * because the decision about who may use this deployment must not depend on
   * which kind of client someone signed in from.
   * @param channel - the channel the person chose.
   * @param returnTo - the deployment's own callback address; a self-driven channel ignores it.
   * @returns their new session, or where to send the browser.
   * @throws {SignInRefused} when the channel is unknown, the directory did not
   * complete, or this deployment admits them as nobody.
   */
  async begin(channel: ChannelId, returnTo: string): Promise<SignInOutcome> {
    const mounted = this.mounted(channel)
    if (mounted.kind === 'redirect') {
      return { kind: 'redirect', start: await mounted.start(returnTo) }
    }
    const subject = await mounted.authenticate()
    return { kind: 'session', session: await this.admitAndEstablish(channel, subject) }
  }

  /**
   * Finish the sign-in a redirect channel's directory is returning from.
   * @param channel - the channel that started it.
   * @param parameters - the query the directory came back with.
   * @returns the bearer identity of their new session.
   * @throws {SignInRefused} when the channel is unknown or self-driven, the return
   * completes no sign-in, or this deployment admits them as nobody.
   */
  async resume(channel: ChannelId, parameters: URLSearchParams): Promise<AuthSessionId> {
    const mounted = this.mounted(channel)
    if (mounted.kind !== 'redirect') throw new SignInRefused('nothing-to-resume')
    return this.admitAndEstablish(channel, await mounted.complete(parameters))
  }

  /** The channel of that id, or the refusal a caller naming an unmounted one gets. */
  private mounted(channel: ChannelId): SignInChannel {
    const found = this.channels.get(channel)
    if (found === undefined) throw new SignInRefused('channel-unknown')
    return found
  }

  /**
   * The half both shapes share: admit the verified subject, then establish.
   *
   * The session is established last, after both the directory and the
   * admission rule have answered, so a refused sign-in leaves no session
   * behind to be revoked.
   */
  private async admitAndEstablish(
    channel: ChannelId,
    subject: ExternalSubject | undefined,
  ): Promise<AuthSessionId> {
    if (subject === undefined) throw new SignInRefused('not-authenticated')
    const person = await this.ctx.signInAdmission.admit(subject)
    if (person === undefined) throw new SignInRefused('not-admitted')
    const session = await this.ctx.authSessions.establish({
      person,
      method: `sign-in:${channel}`,
      lifetimeMs: this.terms.lifetimeMs,
    })
    return session.id
  }
}

export default SignIn
