/**
 * An OpenID Provider as a sign-in channel: whichever directory a deployment
 * runs signs in whoever is at the browser.
 *
 * This is the channel that serves people outside a corporate messenger. The
 * three directory channels each speak one vendor's protocol; this one speaks
 * the standard, so a deployment points it at its own provider and gets email
 * self-registration, verification, password reset and MFA from software whose
 * job that is. Those flows are never implemented here: a sign-in channel's
 * whole job is to hand back a verified subject.
 *
 * It holds nothing. Keeping the person's tokens would make this a credential
 * store with nobody asking for the credential, and the deployment's admission
 * rule decides who that subject is allowed to be.
 *
 * Two deliberate narrowings:
 *
 * - **Endpoints come from discovery, never from configuration.** A deployment
 *   that wrote them itself could point the token exchange at one host and the
 *   authorization at another, which is the shape of a code-theft attack.
 * - **Claims come from the userinfo endpoint, not from the ID token.** Reading
 *   an ID token means verifying its signature against the provider's keys,
 *   which is a JOSE implementation this package has no business carrying.
 *   Userinfo is read over TLS with the access token the exchange returned, so
 *   the answer is the provider's own with no signature to check.
 *
 * @module @lyness/lyn-oidc
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
} from '@lyness/lyn-sign-in/redirect'
import type { ChannelIdentity } from '@lyness/lyn-sign-in/redirect'
import type { RedirectChannelConfig, ResolvedRedirectConfig } from '@lyness/lyn-sign-in/redirect'
import { AttemptBook } from '@lyness/lyn-sign-in/attempts'
import type { RedirectChannel } from '@lyness/lyn-sign-in'
import type { ChannelId, RedirectStart } from '@lyness/lyn-sign-in/types'
import { randomUUID } from '@lyness/lyn-util-crypto'
import {
  authorizeUrl,
  challengeOf,
  discoverySchema,
  discoveryUrl,
  failureSchema,
  newVerifier,
  organizationOf,
  tokenReplySchema,
  tokenRequest,
  userinfoReplySchema,
  userinfoRequest,
} from './protocol.ts'
/* jscpd:ignore-end */
import type { Discovery, TokenReply, UserinfoReply } from './protocol.ts'
import type { OidcIssuer, OidcPerson, OidcSubject } from './types.ts'

export * from './protocol.ts'
export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'oidc-channel'

/** The sign-in registry this channel offers itself to. */
export const inject = ['signIn', 'credentials']

/** The channel id a deployment names in a binding and a surface names in a request. */
export const CHANNEL_ID = channelId('oidc')

/** Name a sign-in page shows on the button. */
export const DISPLAY_NAME = 'Single sign-on'

/** Scopes requested at sign-in: the person's identity and their address. */
export const DEFAULT_SCOPE = 'openid profile email'

/** Callback path the provider returns the browser to. */
export const DEFAULT_REDIRECT_PATH = '/oauth/callback/oidc'

/** How long one provider's discovery document is reused, in milliseconds. */
export const DEFAULT_DISCOVERY_TTL_MS = 3_600_000

/** An OIDC sign-in that did not complete, with the provider's own code. */
export class OidcSignInError extends Error {
  /** The `error` the provider reported, or undefined for a transport failure. */
  readonly code: string | undefined

  /**
   * @param message - what went wrong, in words a deployment can act on.
   * @param code - the provider's own error code, when it answered with one.
   */
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'OidcSignInError'
    this.code = code
  }
}

/** The provider to sign in against, and how to reach it. */
export interface Config extends RedirectChannelConfig {
  /** Callback path the provider returns to; defaults to this channel's own. */
  redirectPath?: string
  /**
   * The provider's issuer identifier, which is also where discovery is read
   * from. Required, and `https` outside loopback.
   */
  issuer: string
  /** The client this deployment is registered as with the provider. Required. */
  clientId: string
  /** Scopes requested at sign-in; defaults to identity and address. */
  scope?: string
  /**
   * The claim naming the organization a sign-in belongs to, with `.`
   * separating one level.
   *
   * Absent leaves every sign-in the deployment's own, which is the standalone
   * shape. A deployment serving several organizations names the claim its
   * provider carries them in, so one provider instance serves every tenant.
   */
  organizationClaim?: string
  /** The organization this channel instance signs in for; absent is deployment-wide. */
  organization?: string
  /**
   * The authorization parameter that asks the provider for one organization's
   * own sign-in page, when it offers one.
   */
  organizationParameter?: string
  /** How long one discovery document is reused, in milliseconds; defaults to 3600000. */
  discoveryTtlMs?: number
}

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.intersect([
  REDIRECT_CHANNEL_CONFIG,
  z.object({
    redirectPath: z.string().pattern(REDIRECT_PATH_PATTERN).default(DEFAULT_REDIRECT_PATH),
    issuer: z.string().pattern(/^https?:\/\/[^\s]{1,2000}$/u).required(),
    clientId: z.string().pattern(/^[\x21-\x7e]{1,256}$/u).required(),
    scope: z.string().pattern(/^[\x20-\x7e]{1,512}$/u).default(DEFAULT_SCOPE),
    organizationClaim: z.string().pattern(/^[A-Za-z0-9_.-]{1,128}$/u),
    organization: z.string().pattern(/^[A-Za-z0-9_.:-]{1,128}$/u),
    organizationParameter: z.string().pattern(/^[A-Za-z0-9_-]{1,64}$/u),
    discoveryTtlMs: z.number().step(1).min(60_000).max(86_400_000).default(DEFAULT_DISCOVERY_TTL_MS),
  }),
])

/** Configuration with every default applied. */
export interface ResolvedConfig extends ResolvedRedirectConfig {
  /** Callback path the provider returns the browser to. */
  readonly redirectPath: string
  readonly issuer: string
  readonly clientId: string
  readonly scope: string
  readonly organizationClaim: string | undefined
  readonly organization: string | undefined
  readonly organizationParameter: string | undefined
  readonly discoveryTtlMs: number
}

/**
 * Apply every default for a configuration built without the Loader.
 * @param config - validated or hand-built configuration.
 * @returns the same configuration with defaults filled in.
 * @throws {Error} when the named secret is not a credential reference, or the
 * issuer is plain HTTP outside loopback.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  if (!isCredentialRefName(config.secret)) {
    throw new Error(`oidc: "${config.secret}" is not a credential reference`)
  }
  assertTransport(config.issuer)
  return {
    issuer: config.issuer,
    clientId: config.clientId,
    secret: config.secret,
    scope: config.scope ?? DEFAULT_SCOPE,
    organizationClaim: config.organizationClaim,
    organization: config.organization,
    organizationParameter: config.organizationParameter,
    discoveryTtlMs: config.discoveryTtlMs ?? DEFAULT_DISCOVERY_TTL_MS,
    redirectPath: config.redirectPath ?? DEFAULT_REDIRECT_PATH,
    attemptTtlMs: config.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

/**
 * Refuse a provider reached without TLS.
 *
 * The authorization code and the access token both cross this connection, so
 * plain HTTP is a sign-in anybody on the path can take over. Loopback is
 * allowed because that is where a provider runs while somebody develops
 * against it.
 * @param issuer - the configured issuer.
 * @throws {Error} when the issuer is plain HTTP to anywhere but loopback.
 */
function assertTransport(issuer: string): void {
  let url: URL
  try {
    url = new URL(issuer)
  } catch {
    throw new Error(`oidc: "${issuer}" is not a URL`)
  }
  if (url.protocol === 'https:') return
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') return
  throw new Error(`oidc: the issuer "${issuer}" is plain HTTP; a sign-in crosses it, so it must be https`)
}

/**
 * Fold one provider's person into the channel-agnostic subject a sign-in admits.
 *
 * The issuer and the `sub` claim are the two values a provider promises not to
 * reuse; a name and an address both change, and a binding written against
 * either would admit the wrong person after a rename.
 * @param person - what the provider reported.
 * @returns the same person, in the vocabulary admission reads.
 */
export function asExternalSubject(person: OidcPerson): ExternalSubject {
  return {
    channel: CHANNEL_ID,
    issuer: person.issuer,
    subject: person.subject,
    ...person.name === undefined ? {} : { displayName: person.name },
    ...person.email === undefined ? {} : { address: person.email },
  }
}

/** What one OIDC sign-in must remember while the browser is at the provider. */
interface OidcAttempt {
  /** The PKCE verifier the token exchange repeats. */
  readonly verifier: string
}

/**
 * An OpenID Provider as a redirect channel.
 *
 * It implements the channel contract directly rather than extending
 * `StatefulRedirectChannel`: that base models attempts with nothing to
 * remember, and this flow has to carry a PKCE verifier from the authorization
 * request to the token exchange. Keeping it on the instance instead would make
 * two sign-ins in flight overwrite each other's, so the attempt book carries
 * it — which is what the book's type parameter is for.
 */
export class OidcChannel implements RedirectChannel {
  readonly kind = 'redirect' as const

  /** The channel id a deployment names in a binding. */
  readonly id: ChannelId

  /** Name a sign-in page shows on the button. */
  readonly displayName: string

  /** The organization this instance belongs to; undefined is the deployment's own. */
  readonly organization: string | undefined

  /** This channel's configuration, with every default applied. */
  readonly config: ResolvedConfig

  /** The attempts this channel has in flight, each holding its own verifier. */
  private readonly attempts: AttemptBook<OidcAttempt>

  /** The provider's discovered endpoints, and when they stop being reused. */
  private discovered: { readonly document: Discovery; readonly expiresAt: number } | undefined

  /**
   * @param ctx - context providing the credential store.
   * @param config - validated provider configuration.
   * @param identity - who this instance is, where its kind can build several.
   */
  constructor(
    private readonly ctx: Context,
    config: Config,
    identity: ChannelIdentity = { id: CHANNEL_ID, displayName: DISPLAY_NAME },
  ) {
    this.config = resolveConfig(config)
    this.id = identity.id
    this.displayName = identity.displayName
    this.organization = identity.organization ?? this.config.organization
    this.attempts = new AttemptBook<OidcAttempt>(this.config.attemptTtlMs)
  }

  /**
   * Read the provider's discovery document, unless a fresh one is held.
   *
   * Called at mount and before every sign-in, so a provider that was down at
   * boot is reached at the first sign-in instead of leaving the channel
   * permanently broken.
   * @throws {OidcSignInError} when the provider cannot be reached, its document
   * is unreadable, or it calls itself by another name.
   */
  async prepare(): Promise<void> {
    if (this.discovered !== undefined && this.discovered.expiresAt > Date.now()) return
    const payload = await this.request(discoveryUrl(this.config.issuer), 'read the provider configuration', {})
    const document = this.read(payload, discoverySchema, 'read the provider configuration')
    // The issuer the document claims must be the one that was asked, or every
    // endpoint in it belongs to somebody else.
    if (trimSlash(document.issuer) !== trimSlash(this.config.issuer)) {
      throw new OidcSignInError(`oidc: the provider at "${this.config.issuer}" calls itself "${document.issuer}"`)
    }
    this.discovered = { document, expiresAt: Date.now() + this.config.discoveryTtlMs }
  }

  /**
   * Begin one sign-in.
   *
   * The attempt's state is also its id, because a provider echoes exactly one
   * opaque value back. Its verifier is recorded with it, and the callback the
   * request named is recorded by the book, so the exchange repeats both
   * exactly.
   * @param returnTo - the deployment's own callback address.
   * @returns the page to send the browser to, and the attempt it belongs to.
   * @throws {OidcSignInError} when the provider cannot be discovered.
   */
  async start(returnTo: string): Promise<RedirectStart> {
    await this.prepare()
    const document = this.documentOrThrow()
    const state = randomUUID()
    const verifier = newVerifier()
    this.attempts.open(state, { verifier }, returnTo)
    return { to: authorizeUrl(document, this.config, state, challengeOf(verifier), returnTo).toString(), attempt: state }
  }

  /**
   * Finish the sign-in the provider is returning from.
   *
   * The attempt is spent before its code is, so a replayed callback link finds
   * nothing waiting.
   * @param parameters - the query the provider came back with.
   * @returns the verified subject, or undefined when the return completes no sign-in.
   * @throws {OidcSignInError} when the provider refuses a request or will not report the person.
   */
  async complete(parameters: URLSearchParams): Promise<ExternalSubject | undefined> {
    const state = parameters.get('state')
    const code = parameters.get('code')
    if (state === null || code === null) return undefined
    const attempt = this.attempts.take(state)
    if (attempt === undefined) return undefined
    const document = this.documentOrThrow()
    const token = await this.exchange(document, code, attempt.held.verifier, attempt.redirectUri)
    const reply = await this.userinfo(document, token.access_token)
    const name = nameOf(reply.claims)
    const organization = organizationOf(reply.payload, this.config.organizationClaim)
    return asExternalSubject({
      issuer: brandString<OidcIssuer>(document.issuer),
      subject: brandString<OidcSubject>(reply.claims.sub),
      ...name === undefined ? {} : { name },
      ...reply.claims.email === undefined ? {} : { email: reply.claims.email },
      ...organization === undefined ? {} : { organization },
    })
  }

  /** The discovered document, or a refusal saying it is not read yet. */
  private documentOrThrow(): Discovery {
    const document = this.discovered?.document
    /* v8 ignore next -- unreachable: `start` prepares before it reads this, and
       `complete` reaches it only for an attempt `start` opened, so the document
       is always held by then. The guard stays because the field's type permits
       absence and a future caller would otherwise read undefined endpoints. */
    if (document === undefined) throw new OidcSignInError('oidc: the provider has not been discovered yet')
    return document
  }

  /** Exchange one authorization code for an access token. */
  private async exchange(
    document: Discovery,
    code: string,
    verifier: string,
    returnTo: string,
  ): Promise<TokenReply> {
    const resolved = await this.ctx.credentials.resolve(credentialRef(this.config.secret))
    if (resolved === undefined) {
      throw new OidcSignInError(`oidc: the credential "${this.config.secret}" holds no client secret`)
    }
    const request = tokenRequest(document, this.config, resolved.value, code, verifier, returnTo)
    const payload = await this.request(request.url, 'exchange the authorization code', {
      method: 'POST',
      body: request.body.toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    })
    return this.read(payload, tokenReplySchema, 'exchange the authorization code')
  }

  /** Read who one access token belongs to. */
  private async userinfo(
    document: Discovery,
    token: string,
  ): Promise<{ readonly claims: UserinfoReply; readonly payload: unknown }> {
    const request = userinfoRequest(document, token)
    const payload = await this.request(request.url, 'read the person', { headers: request.headers })
    return { claims: this.read(payload, userinfoReplySchema, 'read the person'), payload }
  }

  /**
   * Perform one request, raising the provider's own refusal.
   *
   * A provider reports a refusal with a non-2xx status and an OAuth error
   * body, so the status decides and the body says what to report.
   */
  private async request(url: URL, attempt: string, init: RequestInit): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs)
    let response: Response
    try {
      response = await fetch(url, { ...init, signal })
    } catch (error: unknown) {
      throw new OidcSignInError(`oidc: the provider could not be reached: ${messageOf(error)}`)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error: unknown) {
      if (!response.ok) {
        throw new OidcSignInError(`oidc: could not ${attempt}: the provider answered ${String(response.status)}`)
      }
      throw new OidcSignInError(`oidc: the provider's answer was not JSON: ${messageOf(error)}`)
    }
    if (!response.ok) {
      const failure = failureSchema.safeParse(payload)
      const detail = failure.success ? failure.data.error_description ?? failure.data.error : undefined
      throw new OidcSignInError(
        `oidc: could not ${attempt}: ${detail ?? `the provider answered ${String(response.status)}`}`,
        failure.success ? failure.data.error : undefined,
      )
    }
    return payload
  }

  /** Validate one reply the provider accepted. */
  private read<T>(payload: unknown, schema: { parse: (value: unknown) => T }, attempt: string): T {
    try {
      return schema.parse(payload)
    } catch (error: unknown) {
      throw new OidcSignInError(`oidc: could not ${attempt}: unreadable answer (${messageOf(error)})`)
    }
  }
}

/** The display name one reply carries, preferring the full name. */
function nameOf(claims: UserinfoReply): string | undefined {
  return claims.name ?? claims.preferred_username
}

/** An issuer comparison that ignores the one trailing slash providers disagree about. */
function trimSlash(issuer: string): string {
  return issuer.endsWith('/') ? issuer.slice(0, -1) : issuer
}

/** One error's message, whatever was thrown. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Register one composition-written OIDC channel.
 * @param ctx - context providing the sign-in registry and the credential store.
 * @param config - the provider this deployment signs in against.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const channel = new OidcChannel(ctx, config)
  // Discovery is read at mount so a misconfigured issuer is a boot diagnostic
  // rather than a refused sign-in; a provider that is merely down is retried
  // at the first sign-in, so this failure is logged and not thrown.
  try {
    await channel.prepare()
  } catch (error: unknown) {
    ctx.logger.warn(`oidc: the provider was not reachable at mount: ${messageOf(error)}`)
  }
  ctx.effect(() => ctx.signIn.register(channel))
}
