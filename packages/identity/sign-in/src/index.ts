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
import type { ChannelDescription, ChannelId, ExternalSubject, SignInRefusal } from './types.ts'

export type { ChannelDescription, ChannelId, ExternalSubject, SignInRefusal } from './types.ts'
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

/** One mounted sign-in channel. */
export interface SignInChannel extends ChannelDescription {
  /**
   * Run one sign-in against the directory.
   * @returns the verified subject, or undefined when the person did not complete it.
   */
  authenticate(): Promise<ExternalSubject | undefined>
}

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
    return [...this.channels.values()].map(({ id, displayName }) => ({ id, displayName }))
  }

  /**
   * Sign a person in through one channel.
   *
   * The session is established last, after both the directory and the
   * admission rule have answered, so a refused sign-in leaves no session
   * behind to be revoked.
   * @param channel - the channel the person chose.
   * @returns the bearer identity of their new session.
   * @throws {SignInRefused} when the channel is unknown, the directory did not complete, or this deployment admits them as nobody.
   */
  async begin(channel: ChannelId): Promise<AuthSessionId> {
    const mounted = this.channels.get(channel)
    if (mounted === undefined) throw new SignInRefused('channel-unknown')
    const subject = await mounted.authenticate()
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
