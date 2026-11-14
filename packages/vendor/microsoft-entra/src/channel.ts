/**
 * Microsoft Entra ID as a sign-in channel for a hosted deployment.
 *
 * This is the redirect shape, and it exists separately from the service in
 * `./index` because the two sign-ins are not the same operation. That one
 * signs in the single operator who runs an install and stores their grant
 * under one credential key; this one signs in whichever of a customer's staff
 * is at the browser, keeps nothing, and refuses to be the only answer to who
 * they are — the deployment's admission rule decides that.
 *
 * Nothing is stored: a channel's whole job is to hand back a verified subject
 * for one sign-in. Holding the person's directory tokens would make this a
 * credential store with no one asking for the credential.
 *
 * @module @deepseek-ai/dsh-microsoft-entra/channel
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { channelId } from '@deepseek-ai/dsh-sign-in'
import type { ExternalSubject, RedirectChannel, RedirectStart } from '@deepseek-ai/dsh-sign-in'
import { AttemptBook } from '@deepseek-ai/dsh-sign-in/attempts'
import { Config as EntraConfig, createSecrets, resolveConfig } from './index.ts'
import type { Config as ServiceConfig, ResolvedConfig } from './index.ts'
import { authorizeUrl } from './protocol.ts'
import type { AttemptSecrets } from './protocol.ts'
import { readSubject, redeemCode } from './exchange.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'microsoft-entra-channel'

/** The sign-in registry this channel offers itself to. */
export const inject = ['signIn']

/** The channel id a deployment names in a binding and a surface names in a request. */
export const CHANNEL_ID = channelId('microsoft-entra')

/** Name a sign-in page shows on the button. */
export const DISPLAY_NAME = 'Microsoft Entra ID'

/** How long one browser round trip may take before its attempt is forgotten, in milliseconds. */
export const DEFAULT_ATTEMPT_TTL_MS = 600_000

/** The directory to sign in against, plus how long a round trip may take. */
export interface Config extends ServiceConfig {
  /**
   * How long an unfinished attempt is remembered, in milliseconds. Defaults
   * to ten minutes.
   *
   * It bounds what a stolen callback link is worth and how long someone may
   * leave the directory's page open. A deployment whose staff sign in through
   * a slow conditional-access policy raises it.
   */
  attemptTtlMs?: number
}

export const Config: z<Config> = z.intersect([
  EntraConfig,
  z.object({
    attemptTtlMs: z.number().step(1).min(30_000).max(3_600_000).default(DEFAULT_ATTEMPT_TTL_MS),
  }),
])

/**
 * Apply the attempt lifetime default for a config built without the Loader.
 * @param config - validated or hand-built configuration.
 * @returns how long an unfinished attempt is remembered, in milliseconds.
 */
export function resolveAttemptTtl(config: Config): number {
  return config.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS
}

/**
 * Fold an Entra subject into the channel-agnostic one a sign-in admits.
 *
 * The directory id is the issuer and the object id is the subject, because
 * those are the two values that do not change: a display name and a sign-in
 * address both do, and a binding written against either would admit the wrong
 * person after a rename.
 * @param subject - what the directory reported.
 * @returns the same person, in the vocabulary admission reads.
 */
export function asExternalSubject(subject: {
  readonly objectId: string
  readonly directoryId: string
  readonly displayName?: string | undefined
  readonly address?: string | undefined
}): ExternalSubject {
  return {
    channel: CHANNEL_ID,
    issuer: subject.directoryId,
    subject: subject.objectId,
    ...subject.displayName === undefined ? {} : { displayName: subject.displayName },
    ...subject.address === undefined ? {} : { address: subject.address },
  }
}

/**
 * Entra ID as a redirect channel: start sends the browser to the directory,
 * complete reads what it returns with.
 */
export class EntraChannel implements RedirectChannel {
  readonly kind = 'redirect' as const

  readonly id = CHANNEL_ID

  readonly displayName = DISPLAY_NAME

  private readonly config: ResolvedConfig

  private readonly attempts: AttemptBook<AttemptSecrets>

  /**
   * @param config - validated directory configuration and attempt lifetime.
   */
  constructor(config: Config) {
    this.config = resolveConfig(config)
    this.attempts = new AttemptBook<AttemptSecrets>(resolveAttemptTtl(config))
  }

  /**
   * Begin one sign-in.
   *
   * The attempt's state is also its id, because the directory already echoes
   * exactly one opaque value back and a second id would have to be carried
   * somewhere it could be separated from this one.
   * @param returnTo - the deployment's own callback address, which must match the app registration.
   * @returns the directory page to send the browser to, and the attempt it belongs to.
   */
  start(returnTo: string): Promise<RedirectStart> {
    const secrets = createSecrets()
    this.attempts.open(secrets.state, secrets, returnTo)
    return Promise.resolve({
      to: authorizeUrl(this.config, secrets, returnTo).toString(),
      attempt: secrets.state,
    })
  }

  /**
   * Finish the sign-in the directory is returning from.
   *
   * The attempt is removed before the code is redeemed, so one callback can
   * only ever be spent once — a replayed link finds nothing waiting.
   * @param parameters - the query the directory came back with.
   * @returns the verified person, or undefined when the return completes no sign-in.
   * @throws {EntraSignInError} when the directory refuses the redemption or will not report the person.
   */
  async complete(parameters: URLSearchParams): Promise<ExternalSubject | undefined> {
    const state = parameters.get('state')
    const code = parameters.get('code')
    if (state === null || code === null) return undefined
    const attempt = this.attempts.take(state)
    if (attempt === undefined) return undefined
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs)
    const tokens = await redeemCode(this.config, attempt.held, attempt.redirectUri, code, signal)
    return asExternalSubject(await readSubject(this.config, tokens.access_token, signal))
  }
}

/**
 * Offer Entra ID as a sign-in channel.
 * @param ctx - context providing the sign-in registry.
 * @param config - validated directory configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const channel = new EntraChannel(config)
  ctx.effect(() => ctx.signIn.register(channel))
}
