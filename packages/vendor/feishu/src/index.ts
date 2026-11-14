/**
 * Feishu as a sign-in channel: a tenant's own directory signs in whichever of
 * its people is at the browser.
 *
 * It holds nothing. A channel's whole job is to hand back a verified subject
 * for one sign-in; keeping the person's tokens would make this a credential
 * store with nobody asking for the credential. The deployment's admission rule
 * decides who that subject is allowed to be.
 *
 * The application secret is named rather than written: the configuration
 * carries a credential reference and the secret is resolved at the moment a
 * token is needed, so a composition file never holds one.
 *
 * @module @deepseek-ai/dsh-feishu
 */

/* jscpd:ignore-start */
// Every redirect channel reaches the same four seams — a context, a schema, a
// credential store and the sign-in registry — so their import lists are
// identical by construction rather than by copying.
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import { channelId } from '@deepseek-ai/dsh-sign-in'
import type { ExternalSubject } from '@deepseek-ai/dsh-sign-in'
import {
  DEFAULT_ATTEMPT_TTL_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  REDIRECT_CHANNEL_CONFIG,
  REDIRECT_PATH_PATTERN,
  StatefulRedirectChannel,
} from '@deepseek-ai/dsh-sign-in/redirect'
import type { ChannelIdentity } from '@deepseek-ai/dsh-sign-in/redirect'
import type { RedirectChannelConfig, ResolvedRedirectConfig } from '@deepseek-ai/dsh-sign-in/redirect'
import {
  OK,
  appTokenReplySchema,
  appTokenRequest,
  authorizeUrl,
  userInfoReplySchema,
  userInfoRequest,
  userTokenReplySchema,
  userTokenRequest,
} from './protocol.ts'
/* jscpd:ignore-end */
import type { FeishuSubject, FeishuTenantKey, FeishuUnionId } from './types.ts'

export * from './protocol.ts'
export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'feishu-channel'

/** The sign-in registry this channel offers itself to. */
export const inject = ['signIn', 'credentials']

/** The channel id a deployment names in a binding and a surface names in a request. */
export const CHANNEL_ID = channelId('feishu')

/** Name a sign-in page shows on the button. */
export const DISPLAY_NAME = '飞书'

/** API origin of the public Feishu service. */
export const DEFAULT_API_ORIGIN = 'https://open.feishu.cn'

/** Callback path the tenant returns the browser to. */
export const DEFAULT_REDIRECT_PATH = '/oauth/callback/feishu'

/** A Feishu sign-in that did not complete, with the tenant's own code. */
export class FeishuSignInError extends Error {
  /** The `code` the tenant reported, or undefined for a transport failure. */
  readonly code: number | undefined

  /**
   * @param message - what went wrong, in words a deployment can act on.
   * @param code - the tenant's own code, when it answered with one.
   */
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'FeishuSignInError'
    this.code = code
  }
}

/** The application to sign in with, and how to reach it. */
export interface Config extends RedirectChannelConfig {
  /** Callback path the directory returns to; defaults to this channel's own. */
  redirectPath?: string
  /** The application's own id, which Feishu calls `app_id`. Required. */
  appId: string
  /**
   * API origin; defaults to the public Feishu service.
   *
   * An international deployment points this at Lark's own origin, which
   * serves the same interface under a different name.
   */
  apiOrigin?: string
}

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.intersect([
  REDIRECT_CHANNEL_CONFIG,
  z.object({
    redirectPath: z.string().pattern(REDIRECT_PATH_PATTERN).default(DEFAULT_REDIRECT_PATH),
    appId: z.string().pattern(/^[A-Za-z0-9_-]{1,64}$/u).required(),
    apiOrigin: z.string().default(DEFAULT_API_ORIGIN),
  }),
])

/** Configuration with every default applied. */
export interface ResolvedConfig extends ResolvedRedirectConfig {
  /** Callback path the tenant returns the browser to. */
  readonly redirectPath: string
  readonly appId: string
  readonly apiOrigin: string
}

/**
 * Apply every default for a configuration built without the Loader.
 * @param config - validated or hand-built configuration.
 * @returns the same configuration with defaults filled in.
 * @throws {Error} when the named secret is not a credential reference.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  if (!isCredentialRefName(config.secret)) {
    throw new Error(`feishu: "${config.secret}" is not a credential reference`)
  }
  return {
    appId: config.appId,
    secret: config.secret,
    apiOrigin: config.apiOrigin ?? DEFAULT_API_ORIGIN,
    redirectPath: config.redirectPath ?? DEFAULT_REDIRECT_PATH,
    attemptTtlMs: config.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

/**
 * Fold a Feishu person into the channel-agnostic subject a sign-in admits.
 *
 * The tenant key is the issuer and the union id is the subject, because those
 * are the two values that do not change: a name and an address both do, and a
 * binding written against either would admit the wrong person after a rename.
 * @param subject - what the tenant reported.
 * @returns the same person, in the vocabulary admission reads.
 */
export function asExternalSubject(subject: FeishuSubject): ExternalSubject {
  return {
    channel: CHANNEL_ID,
    issuer: subject.tenantKey,
    subject: subject.unionId,
    ...subject.name === undefined ? {} : { displayName: subject.name },
    ...subject.email === undefined ? {} : { address: subject.email },
  }
}

/* jscpd:ignore-start */
// The preamble of implementing the redirect seam: an id, a button name, and a
// constructor that resolves its own configuration. It is the same five lines in
// every channel because the base class owns everything that could differ.
/** Feishu as a redirect channel: start sends the browser away, complete reads what comes back. */
export class FeishuChannel extends StatefulRedirectChannel<ResolvedConfig> {
  /**
   * @param ctx - context providing the credential store.
   * @param config - validated application configuration.
   */
  constructor(
    private readonly ctx: Context,
    config: Config,
    identity: ChannelIdentity = { id: CHANNEL_ID, displayName: DISPLAY_NAME },
  ) {
    super(resolveConfig(config), identity)
  }

  /** Where the tenant's own sign-in page is, for one attempt. */
  protected override authorize(state: string, returnTo: string): string {
    return authorizeUrl(this.config, state, returnTo).toString()
  }
  /* jscpd:ignore-end */

  /**
   * Turn one authorization code into the person it belongs to.
   *
   * Two legs, because Feishu's exchange is authorized by the application
   * rather than by the code alone: the application's token buys the person's
   * token, and the person's token reads the person.
   * @param code - the code the callback carried.
   * @returns the verified person, or undefined when no tenant holds them.
   * @throws {FeishuSignInError} when the tenant refuses a request or will not report the person.
   */
  protected override async verify(code: string): Promise<ExternalSubject | undefined> {
    const appToken = await this.applicationToken()
    const userToken = await this.personToken(appToken, code)
    const person = await this.person(userToken)
    // A person the directory reports without a tenant is signing in with a
    // personal Feishu account: no tenant holds them, so no binding could name
    // them.
    if (person.tenant_key === undefined) return undefined
    const held = address(person)
    return asExternalSubject({
      tenantKey: brandString<FeishuTenantKey>(person.tenant_key),
      unionId: brandString<FeishuUnionId>(person.union_id),
      ...person.name === undefined ? {} : { name: person.name },
      ...held === undefined ? {} : { email: held },
    })
  }

  /** The application's own token, fetched per sign-in. */
  private async applicationToken(): Promise<string> {
    const resolved = await this.ctx.credentials.resolve(credentialRef(this.config.secret))
    if (resolved === undefined) {
      throw new FeishuSignInError(`feishu: the credential "${this.config.secret}" holds no application secret`)
    }
    const request = appTokenRequest(this.config, resolved.value)
    const reply = await this.post(request.url, request.body, {}, appTokenReplySchema, 'issue an application token')
    if (reply.app_access_token === undefined) {
      throw new FeishuSignInError('feishu: the tenant reported success without an application token')
    }
    return reply.app_access_token
  }

  /** Exchange one authorization code for the person's own token. */
  private async personToken(appToken: string, code: string): Promise<string> {
    const request = userTokenRequest(this.config, appToken, code)
    const reply = await this.post(
      request.url,
      request.body,
      request.headers,
      userTokenReplySchema,
      'exchange the authorization code',
    )
    if (reply.data === undefined) {
      throw new FeishuSignInError('feishu: the tenant reported success without a person token')
    }
    return reply.data.access_token
  }

  /** Read who one person token belongs to. */
  private async person(userToken: string): Promise<NonNullable<ReturnType<typeof userInfoReplySchema.parse>['data']>> {
    const request = userInfoRequest(this.config, userToken)
    const reply = this.read(
      await this.fetch(request.url, { headers: request.headers }),
      userInfoReplySchema,
      'read the person',
    )
    if (reply.data === undefined) {
      throw new FeishuSignInError('feishu: the tenant reported success without a person')
    }
    return reply.data
  }

  /** One POST, validated and checked for the tenant's own refusal. */
  private async post<T extends { code: number; msg: string }>(
    url: URL,
    body: Record<string, string>,
    headers: Record<string, string>,
    schema: { parse: (value: unknown) => T },
    attempt: string,
  ): Promise<T> {
    const payload = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { ...headers, 'content-type': 'application/json' },
    })
    return this.read(payload, schema, attempt)
  }

  /** Perform one request against the tenant. */
  private async fetch(url: URL, init: RequestInit): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs)
    let response: Response
    try {
      response = await fetch(url, { ...init, signal })
    } catch (error: unknown) {
      throw new FeishuSignInError(`feishu: the tenant could not be reached: ${messageOf(error)}`)
    }
    if (!response.ok) {
      throw new FeishuSignInError(`feishu: the tenant answered ${String(response.status)}`)
    }
    try {
      return await response.json()
    } catch (error: unknown) {
      throw new FeishuSignInError(`feishu: the tenant's answer was not JSON: ${messageOf(error)}`)
    }
  }

  /** Validate one reply and raise the tenant's own refusal. */
  private read<T extends { code: number; msg: string }>(
    payload: unknown,
    schema: { parse: (value: unknown) => T },
    attempt: string,
  ): T {
    let reply: T
    try {
      reply = schema.parse(payload)
    } catch (error: unknown) {
      throw new FeishuSignInError(`feishu: could not ${attempt}: unreadable answer (${messageOf(error)})`)
    }
    if (reply.code !== OK) {
      throw new FeishuSignInError(`feishu: could not ${attempt}: ${reply.msg}`, reply.code)
    }
    return reply
  }
}

/** The address the directory holds, preferring the one the tenant issued. */
function address(person: { email?: string | undefined; enterprise_email?: string | undefined }): string | undefined {
  return person.enterprise_email ?? person.email
}

/** The message one thrown value carries. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Offer Feishu as a sign-in channel.
 * @param ctx - context providing the sign-in registry and the credential store.
 * @param config - validated application configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const channel = new FeishuChannel(ctx, config)
  ctx.effect(() => ctx.signIn.register(channel))
}
