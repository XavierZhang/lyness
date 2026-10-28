/**
 * DingTalk as a sign-in channel: an organization's own directory signs in
 * whichever of its people is at the browser.
 *
 * It holds nothing. A channel's whole job is to hand back a verified subject
 * for one sign-in; keeping the person's tokens would make this a credential
 * store with nobody asking for the credential. The deployment's admission rule
 * decides who that subject is allowed to be.
 *
 * The application secret is named rather than written: the configuration
 * carries a credential reference and the secret is resolved at the moment a
 * token is exchanged, so a composition file never holds one.
 *
 * @module @lyness/lyn-dingtalk
 */

/* jscpd:ignore-start */
// Every redirect channel reaches the same four seams — a context, a schema, a
// credential store and the sign-in registry — so their import lists are
// identical by construction rather than by copying.
import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import { credentialRef, isCredentialRefName } from '@lyness/lyn-credentials'
import type {} from '@lyness/lyn-credentials'
import { channelId } from '@lyness/lyn-sign-in'
import type { ExternalSubject } from '@lyness/lyn-sign-in'
import {
  DEFAULT_ATTEMPT_TTL_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  REDIRECT_CHANNEL_CONFIG,
  REDIRECT_PATH_PATTERN,
  StatefulRedirectChannel,
} from '@lyness/lyn-sign-in/redirect'
import type { ChannelIdentity } from '@lyness/lyn-sign-in/redirect'
import type { RedirectChannelConfig, ResolvedRedirectConfig } from '@lyness/lyn-sign-in/redirect'
import {
  authorizeUrl,
  failureSchema,
  tokenReplySchema,
  tokenRequest,
  userReplySchema,
  userRequest,
} from './protocol.ts'
/* jscpd:ignore-end */
import type { TokenReply, UserReply } from './protocol.ts'
import type { DingtalkCorpId, DingtalkSubject, DingtalkUnionId } from './types.ts'

export * from './protocol.ts'
export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dingtalk-channel'

/** The sign-in registry this channel offers itself to. */
export const inject = ['signIn', 'credentials']

/** The channel id a deployment names in a binding and a surface names in a request. */
export const CHANNEL_ID = channelId('dingtalk')

/** Name a sign-in page shows on the button. */
export const DISPLAY_NAME = '钉钉'

/** Sign-in host of the public DingTalk service. */
export const DEFAULT_LOGIN_HOST = 'login.dingtalk.com'

/** API origin of the public DingTalk service. */
export const DEFAULT_API_ORIGIN = 'https://api.dingtalk.com'

/** Scope requested at sign-in: the person's identity and nothing else. */
export const DEFAULT_SCOPE = 'openid'

/** Callback path the organization returns the browser to. */
export const DEFAULT_REDIRECT_PATH = '/oauth/callback/dingtalk'

/** A DingTalk sign-in that did not complete, with the organization's own code. */
export class DingtalkSignInError extends Error {
  /** The `code` the organization reported, or undefined for a transport failure. */
  readonly code: string | undefined

  /**
   * @param message - what went wrong, in words a deployment can act on.
   * @param code - the organization's own code, when it answered with one.
   */
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'DingtalkSignInError'
    this.code = code
  }
}

/** The organization to sign in against, and how to reach it. */
export interface Config extends RedirectChannelConfig {
  /** Callback path the directory returns to; defaults to this channel's own. */
  redirectPath?: string
  /** The application's own key, which DingTalk calls `AppKey`. Required. */
  appKey: string
  /** Sign-in host; defaults to the public service. */
  loginHost?: string
  /** API origin; defaults to the public service. */
  apiOrigin?: string
  /** Scope requested at sign-in; defaults to the person's identity only. */
  scope?: string
}

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.intersect([
  REDIRECT_CHANNEL_CONFIG,
  z.object({
    redirectPath: z.string().pattern(REDIRECT_PATH_PATTERN).default(DEFAULT_REDIRECT_PATH),
    appKey: z.string().pattern(/^[A-Za-z0-9_-]{1,64}$/u).required(),
    loginHost: z.string().pattern(/^[A-Za-z0-9.-]{1,253}$/u).default(DEFAULT_LOGIN_HOST),
    apiOrigin: z.string().default(DEFAULT_API_ORIGIN),
    scope: z.string().pattern(/^[^\s]{1,128}$/u).default(DEFAULT_SCOPE),
  }),
])

/** Configuration with every default applied. */
export interface ResolvedConfig extends ResolvedRedirectConfig {
  /** Callback path the directory returns the browser to. */
  readonly redirectPath: string
  readonly appKey: string
  readonly loginHost: string
  readonly apiOrigin: string
  readonly scope: string
}

/**
 * Apply every default for a configuration built without the Loader.
 * @param config - validated or hand-built configuration.
 * @returns the same configuration with defaults filled in.
 * @throws {Error} when the named secret is not a credential reference.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  if (!isCredentialRefName(config.secret)) {
    throw new Error(`dingtalk: "${config.secret}" is not a credential reference`)
  }
  return {
    appKey: config.appKey,
    secret: config.secret,
    loginHost: config.loginHost ?? DEFAULT_LOGIN_HOST,
    apiOrigin: config.apiOrigin ?? DEFAULT_API_ORIGIN,
    scope: config.scope ?? DEFAULT_SCOPE,
    redirectPath: config.redirectPath ?? DEFAULT_REDIRECT_PATH,
    attemptTtlMs: config.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

/**
 * Fold a DingTalk person into the channel-agnostic subject a sign-in admits.
 *
 * The organization id is the issuer and the union id is the subject, because
 * those are the two values that do not change: a nickname and an address both
 * do, and a binding written against either would admit the wrong person after
 * a rename.
 * @param subject - what the organization reported.
 * @returns the same person, in the vocabulary admission reads.
 */
export function asExternalSubject(subject: DingtalkSubject): ExternalSubject {
  return {
    channel: CHANNEL_ID,
    issuer: subject.corpId,
    subject: subject.unionId,
    ...subject.nick === undefined ? {} : { displayName: subject.nick },
    ...subject.email === undefined ? {} : { address: subject.email },
  }
}

/* jscpd:ignore-start */
// The preamble of implementing the redirect seam: an id, a button name, and a
// constructor that resolves its own configuration. It is the same five lines in
// every channel because the base class owns everything that could differ.
/** DingTalk as a redirect channel: start sends the browser away, complete reads what comes back. */
export class DingtalkChannel extends StatefulRedirectChannel<ResolvedConfig> {
  /**
   * @param ctx - context providing the credential store.
   * @param config - validated organization configuration.
   */
  constructor(
    private readonly ctx: Context,
    config: Config,
    identity: ChannelIdentity = { id: CHANNEL_ID, displayName: DISPLAY_NAME },
  ) {
    super(resolveConfig(config), identity)
  }

  /** Where DingTalk's own sign-in page is, for one attempt. */
  protected override authorize(state: string, returnTo: string): string {
    return authorizeUrl(this.config, state, returnTo).toString()
  }

  /* jscpd:ignore-end */

  /**
   * The authorization code this callback carries.
   *
   * Both names, because DingTalk's callback has used each across its own
   * revisions and a channel that read only one would simply stop signing
   * people in.
   * @param parameters - the query the organization came back with.
   * @returns the code, or undefined when the return carries none.
   */
  protected override codeOf(parameters: URLSearchParams): string | undefined {
    return parameters.get('authCode') ?? parameters.get('code') ?? undefined
  }

  /**
   * Turn one authorization code into the person it belongs to.
   * @param code - the code the callback carried.
   * @returns the verified person, or undefined when nobody's directory holds them.
   * @throws {DingtalkSignInError} when the organization refuses a request or will not report the person.
   */
  protected override async verify(code: string): Promise<ExternalSubject | undefined> {
    const token = await this.personToken(code)
    // A token without an organization is a personal DingTalk account signing
    // in: nobody's directory holds them, so no binding could name them.
    if (token.corpId === undefined) return undefined
    const person = await this.person(token.accessToken)
    return asExternalSubject({
      corpId: brandString<DingtalkCorpId>(token.corpId),
      unionId: brandString<DingtalkUnionId>(person.unionId),
      ...person.nick === undefined ? {} : { nick: person.nick },
      ...person.email === undefined ? {} : { email: person.email },
    })
  }

  /** Exchange one authorization code for the person's own token. */
  private async personToken(code: string): Promise<TokenReply> {
    const resolved = await this.ctx.credentials.resolve(credentialRef(this.config.secret))
    if (resolved === undefined) {
      throw new DingtalkSignInError(`dingtalk: the credential "${this.config.secret}" holds no application secret`)
    }
    const request = tokenRequest(this.config, resolved.value, code)
    const payload = await this.fetch(request.url, 'exchange the authorization code', {
      method: 'POST',
      body: JSON.stringify(request.body),
      headers: { 'content-type': 'application/json' },
    })
    return this.read(payload, tokenReplySchema, 'exchange the authorization code')
  }

  /** Read who one person token belongs to. */
  private async person(token: string): Promise<UserReply> {
    const request = userRequest(this.config, token)
    const payload = await this.fetch(request.url, 'read the person', { headers: request.headers })
    return this.read(payload, userReplySchema, 'read the person')
  }

  /**
   * Perform one request, raising the organization's own refusal.
   *
   * The status decides: DingTalk reports a refusal with a non-2xx response
   * whose body names the code, so the body is read for what to say rather
   * than for whether to say it.
   */
  private async fetch(url: URL, attempt: string, init: RequestInit): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs)
    let response: Response
    try {
      response = await fetch(url, { ...init, signal })
    } catch (error: unknown) {
      throw new DingtalkSignInError(`dingtalk: the organization could not be reached: ${messageOf(error)}`)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error: unknown) {
      if (!response.ok) {
        throw new DingtalkSignInError(`dingtalk: could not ${attempt}: the organization answered ${String(response.status)}`)
      }
      throw new DingtalkSignInError(`dingtalk: the organization's answer was not JSON: ${messageOf(error)}`)
    }
    if (!response.ok) {
      const failure = failureSchema.safeParse(payload)
      const detail = failure.success ? failure.data.message ?? failure.data.code : undefined
      throw new DingtalkSignInError(
        `dingtalk: could not ${attempt}: ${detail ?? `the organization answered ${String(response.status)}`}`,
        failure.success ? failure.data.code : undefined,
      )
    }
    return payload
  }

  /** Validate one reply the organization accepted. */
  private read<T>(payload: unknown, schema: { parse: (value: unknown) => T }, attempt: string): T {
    try {
      return schema.parse(payload)
    } catch (error: unknown) {
      throw new DingtalkSignInError(`dingtalk: could not ${attempt}: unreadable answer (${messageOf(error)})`)
    }
  }
}

/** The message one thrown value carries. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Offer DingTalk as a sign-in channel.
 * @param ctx - context providing the sign-in registry and the credential store.
 * @param config - validated organization configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const channel = new DingtalkChannel(ctx, config)
  ctx.effect(() => ctx.signIn.register(channel))
}
