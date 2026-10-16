/**
 * WeCom as a sign-in channel: a corporation's own directory signs in whichever
 * of its members is at the browser.
 *
 * It holds nothing. A channel's whole job is to hand back a verified subject
 * for one sign-in; keeping the member's tokens would make this a credential
 * store with nobody asking for the credential. The deployment's admission rule
 * decides who that subject is allowed to be.
 *
 * The application secret is named rather than written: the configuration
 * carries a credential reference and the secret is resolved at the moment a
 * token is needed, so a composition file never holds one.
 *
 * @module @lyness/lyn-wecom
 */

import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import { credentialRef, isCredentialRefName } from '@lyness/lyn-credentials'
import type {} from '@lyness/lyn-credentials'
import { channelId } from '@lyness/lyn-sign-in'
import type { ExternalSubject, RedirectChannel, RedirectStart } from '@lyness/lyn-sign-in'
import { AttemptBook } from '@lyness/lyn-sign-in/attempts'
import { randomUUID } from '@lyness/lyn-util-crypto'
import {
  OK,
  authorizeUrl,
  tokenReplySchema,
  tokenUrl,
  userDetailReplySchema,
  userDetailUrl,
  userInfoReplySchema,
  userInfoUrl,
} from './protocol.ts'
import type { WecomCorpId, WecomSubject, WecomUserId } from './types.ts'

export * from './protocol.ts'
export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'wecom-channel'

/** The sign-in registry this channel offers itself to. */
export const inject = ['signIn', 'credentials']

/** The channel id a deployment names in a binding and a surface names in a request. */
export const CHANNEL_ID = channelId('wecom')

/** Name a sign-in page shows on the button. */
export const DISPLAY_NAME = '企业微信'

/** Scan-code login host of the public WeCom service. */
export const DEFAULT_LOGIN_HOST = 'login.work.weixin.qq.com'

/** API origin of the public WeCom service. */
export const DEFAULT_API_ORIGIN = 'https://qyapi.weixin.qq.com'

/** Callback path the corporation returns the browser to. */
export const DEFAULT_REDIRECT_PATH = '/oauth/callback/wecom'

/** How long an unfinished attempt is remembered, in milliseconds. */
export const DEFAULT_ATTEMPT_TTL_MS = 600_000

/** Bound on one outbound request, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

/** A WeCom sign-in that did not complete, with the corporation's own code. */
export class WecomSignInError extends Error {
  /** The `errcode` the corporation reported, or undefined for a transport failure. */
  readonly errcode: number | undefined

  /**
   * @param message - what went wrong, in words a deployment can act on.
   * @param errcode - the corporation's own code, when it answered with one.
   */
  constructor(message: string, errcode?: number) {
    super(message)
    this.name = 'WecomSignInError'
    this.errcode = errcode
  }
}

/** The corporation to sign in against, and how to reach it. */
export interface Config {
  /** The corporation's own id, which WeCom calls `corpid`. Required. */
  corpId: string
  /** The self-built application's `agentid`. Required. */
  agentId: string
  /**
   * Credential reference naming the application secret.
   *
   * A reference rather than the secret: a composition file is read by
   * everyone who can read the repository, and an application secret signs in
   * the whole corporation.
   */
  secret: string
  /** Scan-code login host; defaults to the public service. */
  loginHost?: string
  /** API origin; defaults to the public service. */
  apiOrigin?: string
  /** Callback path the corporation returns to; defaults to `/oauth/callback/wecom`. */
  redirectPath?: string
  /**
   * Whether to read member detail — name and work address — after sign-in.
   *
   * Off by default, because it requires the application to hold the private
   * information scope, and a deployment that only binds members by id needs
   * neither value.
   */
  readDetail?: boolean
  /** How long an unfinished attempt is remembered, in milliseconds; defaults to 600000. */
  attemptTtlMs?: number
  /** Bound on one outbound request in milliseconds; defaults to 20000. */
  requestTimeoutMs?: number
}

const idPattern = /^[A-Za-z0-9_-]{1,64}$/u

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.object({
  corpId: z.string().pattern(idPattern).required(),
  agentId: z.string().pattern(/^[0-9]{1,20}$/u).required(),
  secret: z.string().required(),
  loginHost: z.string().pattern(/^[A-Za-z0-9.-]{1,253}$/u).default(DEFAULT_LOGIN_HOST),
  apiOrigin: z.string().default(DEFAULT_API_ORIGIN),
  redirectPath: z.string().pattern(/^\/[A-Za-z0-9/_-]{0,255}$/u).default(DEFAULT_REDIRECT_PATH),
  readDetail: z.boolean().default(false),
  attemptTtlMs: z.number().step(1).min(30_000).max(3_600_000).default(DEFAULT_ATTEMPT_TTL_MS),
  requestTimeoutMs: z.number().step(1).min(1000).default(DEFAULT_REQUEST_TIMEOUT_MS),
})

/** Configuration with every default applied. */
export interface ResolvedConfig {
  readonly corpId: string
  readonly agentId: string
  readonly secret: string
  readonly loginHost: string
  readonly apiOrigin: string
  readonly redirectPath: string
  readonly readDetail: boolean
  readonly attemptTtlMs: number
  readonly requestTimeoutMs: number
}

/**
 * Apply every default for a configuration built without the Loader.
 * @param config - validated or hand-built configuration.
 * @returns the same configuration with defaults filled in.
 * @throws {Error} when the named secret is not a credential reference.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  if (!isCredentialRefName(config.secret)) {
    throw new Error(`wecom: "${config.secret}" is not a credential reference`)
  }
  return {
    corpId: config.corpId,
    agentId: config.agentId,
    secret: config.secret,
    loginHost: config.loginHost ?? DEFAULT_LOGIN_HOST,
    apiOrigin: config.apiOrigin ?? DEFAULT_API_ORIGIN,
    redirectPath: config.redirectPath ?? DEFAULT_REDIRECT_PATH,
    readDetail: config.readDetail ?? false,
    attemptTtlMs: config.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

/**
 * Fold a WeCom member into the channel-agnostic subject a sign-in admits.
 *
 * The corporation id is the issuer and the member id is the subject, because
 * those are the two values that do not change: a name and an address both do,
 * and a binding written against either would admit the wrong person after a
 * rename.
 * @param subject - what the corporation reported.
 * @returns the same person, in the vocabulary admission reads.
 */
export function asExternalSubject(subject: WecomSubject): ExternalSubject {
  return {
    channel: CHANNEL_ID,
    issuer: subject.corpId,
    subject: subject.userId,
    ...subject.name === undefined ? {} : { displayName: subject.name },
    ...subject.email === undefined ? {} : { address: subject.email },
  }
}

/** WeCom as a redirect channel: start sends the browser away, complete reads what comes back. */
export class WecomChannel implements RedirectChannel {
  readonly kind = 'redirect' as const

  readonly id = CHANNEL_ID

  readonly displayName = DISPLAY_NAME

  private readonly config: ResolvedConfig

  private readonly attempts: AttemptBook<null>

  /**
   * @param ctx - context providing the credential store.
   * @param config - validated corporation configuration.
   */
  constructor(private readonly ctx: Context, config: Config) {
    this.config = resolveConfig(config)
    this.attempts = new AttemptBook<null>(this.config.attemptTtlMs)
  }

  /**
   * Begin one sign-in.
   *
   * The attempt's state is also its id, because the corporation echoes exactly
   * one opaque value back and a second id would have to be carried somewhere
   * it could be separated from this one.
   * @param returnTo - the deployment's own callback address.
   * @returns the page to send the browser to, and the attempt it belongs to.
   */
  start(returnTo: string): Promise<RedirectStart> {
    const state = randomUUID()
    this.attempts.open(state, null, returnTo)
    return Promise.resolve({
      to: authorizeUrl(this.config, state, returnTo).toString(),
      attempt: state,
    })
  }

  /**
   * Finish the sign-in the corporation is returning from.
   *
   * The attempt is removed before the code is spent, so one callback can only
   * ever be used once — a replayed link finds nothing waiting.
   * @param parameters - the query the corporation came back with.
   * @returns the verified member, or undefined when the return completes no sign-in.
   * @throws {WecomSignInError} when the corporation refuses a request or will not report the member.
   */
  async complete(parameters: URLSearchParams): Promise<ExternalSubject | undefined> {
    const state = parameters.get('state')
    const code = parameters.get('code')
    if (state === null || code === null) return undefined
    if (this.attempts.take(state) === undefined) return undefined
    const token = await this.applicationToken()
    const identity = await this.request(userInfoUrl(this.config, token, code), userInfoReplySchema, 'read the member')
    // A reply without `userid` is somebody who authenticated through WeChat
    // without being in this corporation's directory. They have no corporation
    // identity, so there is nothing a binding could name them by.
    if (identity.userid === undefined) return undefined
    const subject: WecomSubject = {
      corpId: brandString<WecomCorpId>(this.config.corpId),
      userId: brandString<WecomUserId>(identity.userid),
      ...await this.detail(token, identity.user_ticket),
    }
    return asExternalSubject(subject)
  }

  /** The member's name and address, when the deployment reads detail and the member granted it. */
  private async detail(
    token: string,
    ticket: string | undefined,
  ): Promise<{ name?: string; email?: string }> {
    if (!this.config.readDetail || ticket === undefined) return {}
    const reply = await this.post(
      userDetailUrl(this.config, token),
      { user_ticket: ticket },
      userDetailReplySchema,
      'read the member detail',
    )
    const email = reply.email ?? reply.biz_mail
    return {
      ...reply.name === undefined ? {} : { name: reply.name },
      ...email === undefined ? {} : { email },
    }
  }

  /** The application's own token for this corporation, fetched per sign-in. */
  private async applicationToken(): Promise<string> {
    const resolved = await this.ctx.credentials.resolve(credentialRef(this.config.secret))
    if (resolved === undefined) {
      throw new WecomSignInError(`wecom: the credential "${this.config.secret}" holds no application secret`)
    }
    const reply = await this.request(
      tokenUrl(this.config, resolved.value),
      tokenReplySchema,
      'issue an application token',
    )
    if (reply.access_token === undefined) {
      throw new WecomSignInError('wecom: the corporation reported success without an application token')
    }
    return reply.access_token
  }

  /** One GET, validated and checked for the corporation's own refusal. */
  private async request<T extends { errcode: number; errmsg: string }>(
    url: URL,
    schema: { parse: (value: unknown) => T },
    attempt: string,
  ): Promise<T> {
    return this.read(await this.fetch(url, undefined), schema, attempt)
  }

  /** One POST, validated and checked the same way. */
  private async post<T extends { errcode: number; errmsg: string }>(
    url: URL,
    body: Record<string, string>,
    schema: { parse: (value: unknown) => T },
    attempt: string,
  ): Promise<T> {
    return this.read(await this.fetch(url, body), schema, attempt)
  }

  /** Perform one request against the corporation. */
  private async fetch(url: URL, body: Record<string, string> | undefined): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs)
    let response: Response
    try {
      response = await fetch(url, body === undefined
        ? { signal }
        : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal })
    } catch (error: unknown) {
      throw new WecomSignInError(`wecom: the corporation could not be reached: ${messageOf(error)}`)
    }
    if (!response.ok) {
      throw new WecomSignInError(`wecom: the corporation answered ${String(response.status)}`)
    }
    try {
      return await response.json()
    } catch (error: unknown) {
      throw new WecomSignInError(`wecom: the corporation's answer was not JSON: ${messageOf(error)}`)
    }
  }

  /** Validate one reply and raise the corporation's own refusal. */
  private read<T extends { errcode: number; errmsg: string }>(
    payload: unknown,
    schema: { parse: (value: unknown) => T },
    attempt: string,
  ): T {
    let reply: T
    try {
      reply = schema.parse(payload)
    } catch (error: unknown) {
      throw new WecomSignInError(`wecom: could not ${attempt}: unreadable answer (${messageOf(error)})`)
    }
    if (reply.errcode !== OK) {
      throw new WecomSignInError(`wecom: could not ${attempt}: ${reply.errmsg}`, reply.errcode)
    }
    return reply
  }
}

/** The message one thrown value carries. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Offer WeCom as a sign-in channel.
 * @param ctx - context providing the sign-in registry and the credential store.
 * @param config - validated corporation configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const channel = new WecomChannel(ctx, config)
  ctx.effect(() => ctx.signIn.register(channel))
}
