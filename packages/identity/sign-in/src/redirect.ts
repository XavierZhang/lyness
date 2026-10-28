/**
 * What every redirect channel does the same way.
 *
 * Three directories, three authorization URLs and three token exchanges — and
 * one identical skeleton around them: issue an opaque state, remember the
 * attempt under it, send the browser away, and on the way back spend that
 * attempt exactly once before verifying the code. The skeleton is here so a
 * fourth directory is a URL and an exchange rather than a fourth copy of the
 * bookkeeping.
 *
 * The configuration fields they share are here for the same reason: a host to
 * reach, a callback path, how long an unfinished attempt lives, and how long
 * one outbound request may take are decisions every channel carries, and a
 * deployment should meet them under one set of names.
 *
 * @module @deepseek-ai/dsh-sign-in/redirect
 */

import z from '@deepseek-ai/schemastery'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { AttemptBook } from './attempts.ts'
import type { ChannelId, ExternalSubject, RedirectStart } from './types.ts'
import type { RedirectChannel } from './index.ts'

/** How long an unfinished attempt is remembered, in milliseconds. */
export const DEFAULT_ATTEMPT_TTL_MS = 600_000

/** Bound on one outbound request, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

/**
 * The configuration every redirect channel carries beyond its own directory's
 * fields, and beyond its own callback path — whose default is the channel's,
 * so each one declares it with its own value.
 */
export interface RedirectChannelConfig {
  /**
   * Credential reference naming the application secret.
   *
   * A reference rather than the secret: a composition file is read by
   * everyone who can read the repository, and an application secret signs in
   * everybody the application can reach.
   */
  secret: string
  /** How long an unfinished attempt is remembered, in milliseconds; defaults to 600000. */
  attemptTtlMs?: number
  /** Bound on one outbound request in milliseconds; defaults to 20000. */
  requestTimeoutMs?: number
}

/**
 * The shared half of one channel's configuration schema.
 *
 * A constant rather than a builder because the configuration catalog walks
 * these schemas statically: it follows a reference and stops at a call.
 */
export const REDIRECT_CHANNEL_CONFIG: z<RedirectChannelConfig> = z.object({
  secret: z.string().required(),
  attemptTtlMs: z.number().step(1).min(30_000).max(3_600_000).default(DEFAULT_ATTEMPT_TTL_MS),
  requestTimeoutMs: z.number().step(1).min(1000).default(DEFAULT_REQUEST_TIMEOUT_MS),
})

/** The callback-path pattern every channel's own field uses. */
export const REDIRECT_PATH_PATTERN = /^\/[A-Za-z0-9/_-]{0,255}$/u

/** The resolved configuration every redirect channel carries. */
export interface ResolvedRedirectConfig {
  /** Credential reference naming the application secret. */
  readonly secret: string
  /** How long an unfinished attempt is remembered, in milliseconds. */
  readonly attemptTtlMs: number
  /** Bound on one outbound request, in milliseconds. */
  readonly requestTimeoutMs: number
}

/** Who one channel instance is, where its kind can build several. */
export interface ChannelIdentity {
  /** The channel id a binding names and a sign-in path carries. */
  readonly id: ChannelId
  /** Name a sign-in page shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string | undefined
}

/**
 * A redirect channel that keeps its attempts in this process.
 *
 * A subclass supplies what is its directory's own: where to send the browser,
 * which callback parameter carries the authorization code, and how to turn
 * that code into a verified subject.
 */
export abstract class StatefulRedirectChannel<Resolved extends ResolvedRedirectConfig>
implements RedirectChannel {
  readonly kind = 'redirect' as const

  /** The channel id a deployment names in a binding. */
  readonly id: ChannelId

  /** Name a sign-in page shows on the button. */
  readonly displayName: string

  /**
   * The organization this instance belongs to; `undefined` is the
   * deployment's own, which every sign-in page is offered.
   */
  readonly organization: string | undefined

  /** The attempts this channel has in flight. */
  protected readonly attempts: AttemptBook<null>

  /**
   * @param config - this channel's configuration, with every default applied.
   * @param identity - who this instance is, where its kind can build several.
   */
  protected constructor(protected readonly config: Resolved, identity: ChannelIdentity) {
    this.id = identity.id
    this.displayName = identity.displayName
    this.organization = identity.organization
    this.attempts = new AttemptBook<null>(config.attemptTtlMs)
  }

  /**
   * Begin one sign-in.
   *
   * The attempt's state is also its id, because a directory echoes exactly one
   * opaque value back and a second id would have to be carried somewhere it
   * could be separated from this one.
   * @param returnTo - the deployment's own callback address.
   * @returns the page to send the browser to, and the attempt it belongs to.
   */
  start(returnTo: string): Promise<RedirectStart> {
    const state = randomUUID()
    this.attempts.open(state, null, returnTo)
    return Promise.resolve({ to: this.authorize(state, returnTo), attempt: state })
  }

  /**
   * Finish the sign-in the directory is returning from.
   *
   * The attempt is spent before the code is, so a replayed callback link
   * finds nothing waiting.
   * @param parameters - the query the directory came back with.
   * @returns the verified subject, or undefined when the return completes no sign-in.
   */
  async complete(parameters: URLSearchParams): Promise<ExternalSubject | undefined> {
    const state = parameters.get('state')
    const code = this.codeOf(parameters)
    if (state === null || code === undefined) return undefined
    if (this.attempts.take(state) === undefined) return undefined
    const subject = await this.verify(code)
    if (subject === undefined) return undefined
    // The channel on the subject is this instance, not its kind. A directory
    // reports an issuer the configured channel asserts — a corp id is a
    // settings field — so two configured channels of one kind could otherwise
    // report the same issuer and subject, and one organization's binding
    // would admit a person another organization's channel authenticated.
    return { ...subject, channel: this.id }
  }

  /**
   * The authorization code this directory's callback carries.
   *
   * `code` by default; a directory that names it otherwise overrides this.
   * @param parameters - the query the directory came back with.
   * @returns the code, or undefined when the return carries none.
   */
  protected codeOf(parameters: URLSearchParams): string | undefined {
    return parameters.get('code') ?? undefined
  }

  /**
   * Where to send the browser for one attempt.
   * @param state - the opaque value the callback must echo.
   * @param returnTo - the callback this attempt named.
   * @returns the directory's own page, as a URL string.
   */
  protected abstract authorize(state: string, returnTo: string): string

  /**
   * Turn one authorization code into the person it belongs to.
   * @param code - the code the callback carried.
   * @returns the verified subject, or undefined when no binding could name them.
   */
  protected abstract verify(code: string): Promise<ExternalSubject | undefined>
}
