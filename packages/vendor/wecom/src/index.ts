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
  OK,
  authorizeUrl,
  tokenReplySchema,
  tokenUrl,
  userDetailReplySchema,
  userDetailUrl,
  userInfoReplySchema,
  userInfoUrl,
} from './protocol.ts'
/* jscpd:ignore-end */
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
export interface Config extends RedirectChannelConfig {
  /** Callback path the directory returns to; defaults to this channel's own. */
  redirectPath?: string
  /** The corporation's own id, which WeCom calls `corpid`. Required. */
  corpId: string
  /** The self-built application's `agentid`. Required. */
  agentId: string
  /** Scan-code login host; defaults to the public service. */
  loginHost?: string
  /** API origin; defaults to the public service. */
  apiOrigin?: string
  /**
   * Whether to read member detail — name and work address — after sign-in.
   *
   * Off by default, because it requires the application to hold the private
   * information scope, and a deployment that only binds members by id needs
   * neither value.
   */
  readDetail?: boolean
}

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.intersect([
  REDIRECT_CHANNEL_CONFIG,
  z.object({
    redirectPath: z.string().pattern(REDIRECT_PATH_PATTERN).default(DEFAULT_REDIRECT_PATH),
    corpId: z.string().pattern(/^[A-Za-z0-9_-]{1,64}$/u).required(),
    agentId: z.string().pattern(/^[0-9]{1,20}$/u).required(),
    loginHost: z.string().pattern(/^[A-Za-z0-9.-]{1,253}$/u).default(DEFAULT_LOGIN_HOST),
    apiOrigin: z.string().default(DEFAULT_API_ORIGIN),
    readDetail: z.boolean().default(false),
  }),
])

/** Configuration with every default applied. */
export interface ResolvedConfig extends ResolvedRedirectConfig {
  /** Callback path the directory returns the browser to. */
  readonly redirectPath: string
  readonly corpId: string
  readonly agentId: string
  readonly loginHost: string
  readonly apiOrigin: string
  readonly readDetail: boolean
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

/* jscpd:ignore-start */
// The preamble of implementing the redirect seam: an id, a button name, and a
// constructor that resolves its own configuration. It is the same five lines in
// every channel because the base class owns everything that could differ.
/** WeCom as a redirect channel: start sends the browser away, complete reads what comes back. */
export class WecomChannel extends StatefulRedirectChannel<ResolvedConfig> {
  /**
   * @param ctx - context providing the credential store.
   * @param config - validated corporation configuration.
   */
  constructor(
    private readonly ctx: Context,
    config: Config,
    identity: ChannelIdentity = { id: CHANNEL_ID, displayName: DISPLAY_NAME },
  ) {
    super(resolveConfig(config), identity)
  }

  /** Where the corporation's own scan-code page is, for one attempt. */
  protected override authorize(state: string, returnTo: string): string {
    return authorizeUrl(this.config, state, returnTo).toString()
  }

  /* jscpd:ignore-end */

  /**
   * Turn one authorization code into the member it belongs to.
   * @param code - the code the callback carried.
   * @returns the verified member, or undefined when the corporation's directory holds nobody by it.
   * @throws {WecomSignInError} when the corporation refuses a request or will not report the member.
   */
  protected override async verify(code: string): Promise<ExternalSubject | undefined> {
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
