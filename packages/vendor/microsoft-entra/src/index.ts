/**
 * Microsoft Entra sign-in: the identity face of the Microsoft vendor
 * integration.
 *
 * A person signs in through their own directory and this deployment holds a
 * verified subject for them. The subject comes from an authenticated Microsoft
 * Graph call rather than from id-token claims, so this integration verifies no
 * token signature and carries no key material: the directory answers over TLS,
 * and what it answers is what is stored.
 *
 * The channel face (Teams) is deliberately absent for now; when it arrives it
 * shares this package's application registration and refresh path rather than
 * registering a second credential.
 *
 * @module @lyness/lyn-microsoft-entra
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import z from '@lyness/schemastery'
import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import { credentialKey } from '@lyness/lyn-credentials'
import type { CredentialKey } from '@lyness/lyn-credentials'
import type { AuthorizationSession } from '@lyness/lyn-authorization'
import type {} from '@lyness/lyn-host-webserver'
import {
  authorizeUrl, graphMeSchema, subjectFromGraph, tokenEndpoint, tokenErrorSchema,
  tokenRequestBody, tokenResponseSchema,
} from './protocol.ts'
import type { AttemptSecrets, TokenResponse } from './protocol.ts'
import type { EntraSubject } from './types.ts'

export type { EntraDirectoryId, EntraObjectId, EntraSubject } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Microsoft Entra sign-in and the person it authenticated. */
    microsoftEntra: MicrosoftEntra
  }
}

/** Public Entra authority host; a sovereign cloud names its own. */
export const DEFAULT_AUTHORITY_HOST = 'login.microsoftonline.com'

/** Public Microsoft Graph origin; a sovereign cloud names its own. */
export const DEFAULT_GRAPH_ORIGIN = 'https://graph.microsoft.com'

/**
 * Scopes requested by default.
 *
 * `User.Read` is what makes the authenticated `/me` call possible, and
 * `offline_access` is what makes a refresh token available, so a person does
 * not sign in again on every restart.
 */
export const DEFAULT_SCOPES: readonly string[] = ['openid', 'profile', 'User.Read', 'offline_access']

/** Loopback path the browser returns to. */
export const DEFAULT_REDIRECT_PATH = '/oauth/callback/microsoft-entra'

/** Wall-clock bound on one browser round trip, in milliseconds. */
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 300_000

/** Wall-clock bound on one token or Graph request, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

/** A directory a sign-in is addressed to. */
const directoryPattern = /^[A-Za-z0-9.-]{1,128}$/u

/**
 * Entra application registration this deployment signs in through. Invalid
 * values fail plugin load, because a half-configured sign-in is a sign-in that
 * fails in a browser instead of at boot.
 */
export interface Config {
  /**
   * The directory to sign in to: a tenant id, a verified domain, or one of
   * Entra's multi-tenant audiences (`organizations`, `common`, `consumers`).
   * Required, because no default is correct for someone else's directory.
   */
  directory: string
  /** The application (client) id of the Entra app registration. Required. */
  clientId: string
  /** Authority host; defaults to the public cloud. */
  authorityHost?: string
  /** Microsoft Graph origin; defaults to the public cloud. */
  graphOrigin?: string
  /** Scopes requested at sign-in; defaults to openid, profile, User.Read, offline_access. */
  scopes?: string[]
  /** Loopback path the browser returns to; defaults to `/oauth/callback/microsoft-entra`. */
  redirectPath?: string
  /** Bound on one browser round trip in milliseconds; defaults to 300000. */
  attemptTimeoutMs?: number
  /** Bound on one token or Graph request in milliseconds; defaults to 20000. */
  requestTimeoutMs?: number
}

/** Schemastery configuration for Loader defaults and generated configuration docs. */
export const Config: z<Config> = z.object({
  directory: z.string().pattern(directoryPattern).required(),
  clientId: z.string().pattern(directoryPattern).required(),
  authorityHost: z.string().pattern(/^[A-Za-z0-9.-]{1,253}$/u).default(DEFAULT_AUTHORITY_HOST),
  graphOrigin: z.string().default(DEFAULT_GRAPH_ORIGIN),
  scopes: z.array(z.string().pattern(/^[^\s]{1,256}$/u)).default([...DEFAULT_SCOPES]),
  redirectPath: z.string().pattern(/^\/[A-Za-z0-9/_-]{0,255}$/u).default(DEFAULT_REDIRECT_PATH),
  attemptTimeoutMs: z.number().step(1).min(1000).default(DEFAULT_ATTEMPT_TIMEOUT_MS),
  requestTimeoutMs: z.number().step(1).min(1000).default(DEFAULT_REQUEST_TIMEOUT_MS),
})

/** Configuration with every default applied. */
export interface ResolvedConfig {
  readonly directory: string
  readonly clientId: string
  readonly authorityHost: string
  readonly graphOrigin: string
  readonly scopes: readonly string[]
  readonly redirectPath: string
  readonly attemptTimeoutMs: number
  readonly requestTimeoutMs: number
}

/**
 * Apply the defaults and reject a configuration a browser round trip could not
 * complete.
 * @param config - validated or hand-built configuration.
 * @returns the resolved values this integration runs on.
 * @throws {TypeError} when the scope list cannot obtain an authenticated subject.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  const scopes = config.scopes ?? [...DEFAULT_SCOPES]
  const graphOrigin = (config.graphOrigin ?? DEFAULT_GRAPH_ORIGIN).replace(/\/+$/u, '')
  if (!/^https:\/\/[A-Za-z0-9.-]{1,253}$/u.test(graphOrigin)) {
    throw new TypeError('microsoft-entra: graphOrigin must be an https origin')
  }
  // Without User.Read the sign-in succeeds and the `/me` call then fails, so
  // the failure would surface after the person already used their browser.
  if (!scopes.includes('User.Read')) {
    throw new TypeError('microsoft-entra: scopes must include User.Read to read the signed-in person')
  }
  return {
    directory: config.directory,
    clientId: config.clientId,
    authorityHost: config.authorityHost ?? DEFAULT_AUTHORITY_HOST,
    graphOrigin,
    scopes,
    redirectPath: config.redirectPath ?? DEFAULT_REDIRECT_PATH,
    attemptTimeoutMs: config.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

/** The credential this integration owns. */
export const ENTRA_CREDENTIAL_KEY: CredentialKey = credentialKey('vendor-microsoft-entra', 'grant')

/** What is stored for a signed-in person. Opaque to the credential seam. */
export interface EntraGrant {
  /** The authenticated person. */
  readonly subject: EntraSubject
  /** Bearer token for Graph calls. */
  readonly accessToken: string
  /** Epoch milliseconds after which the access token is spent. */
  readonly expiresAt: number
  /** Present only when the directory granted `offline_access`. */
  readonly refreshToken?: string
}

/** Sign-in failed for a reason worth telling the person apart from a crash. */
export class EntraSignInError extends Error {
  /** @param reason - which step refused, in words a surface can show. */
  constructor(reason: string) {
    super(`microsoft-entra: ${reason}`)
    this.name = 'EntraSignInError'
  }
}

/**
 * Mint one attempt's single-use values. Exported so the request shapes stay
 * checkable without running a browser round trip.
 * @returns a fresh verifier, its S256 challenge, a state, and a nonce.
 */
export function createSecrets(): AttemptSecrets {
  const verifier = randomBytes(32).toString('base64url')
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(16).toString('base64url'),
  }
}

/**
 * Compare a callback's echoed state against the attempt's, in constant time.
 * @param expected - the attempt's state.
 * @param received - what the callback carried.
 * @returns true only for an exact match.
 */
export function stateMatches(expected: string, received: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Microsoft Entra sign-in. */
export class MicrosoftEntra extends Service {
  static inject = ['authorization', 'credentials', 'webServer']

  static Config = Config

  private readonly config: ResolvedConfig

  /**
   * @param ctx - Host providing authorization, the credential store, and the loopback server.
   * @param config - validated application registration and endpoints.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'microsoftEntra')
    this.config = resolveConfig(config)
    ctx.effect(() => ctx.authorization.registerFlow({
      key: ENTRA_CREDENTIAL_KEY,
      label: 'Microsoft Entra ID',
      methods: [{ id: 'browser', label: 'Microsoft Entra ID' }],
      run: session => this.run(session),
    }))
  }

  /**
   * The person this deployment signed in.
   * @returns the stored subject, or undefined while nobody has signed in.
   */
  async subject(): Promise<EntraSubject | undefined> {
    return (await this.grant())?.subject
  }

  /** The stored grant, or undefined while none is stored. */
  private async grant(): Promise<EntraGrant | undefined> {
    const record = await this.ctx.credentials.readRecord(ENTRA_CREDENTIAL_KEY)
    if (record?.kind !== 'grant') return undefined
    return record.payload as EntraGrant
  }

  /** Run one browser sign-in and commit its grant. */
  private async run(session: AuthorizationSession): Promise<void> {
    const secrets = createSecrets()
    // Entra accepts a loopback redirect for a public client, and the literal
    // address is what the app registration has to list, so the configured
    // bind host never enters the URI.
    const redirectUri = `http://127.0.0.1:${String(this.ctx.webServer.port)}${this.config.redirectPath}`
    const code = await this.awaitCallback(session, secrets, redirectUri)
    const tokens = await this.redeem(secrets, redirectUri, code, session.signal)
    const subject = await this.readSubject(tokens.access_token, session.signal)
    const grant: EntraGrant = {
      subject,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      ...tokens.refresh_token === undefined ? {} : { refreshToken: tokens.refresh_token },
    }
    await session.commit({ kind: 'grant', payload: grant })
  }

  /** Open the directory's sign-in page and wait for the loopback callback. */
  private awaitCallback(
    session: AuthorizationSession,
    secrets: AttemptSecrets,
    redirectUri: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Promise settlement is idempotent and every teardown step tolerates a
      // second call, so whichever side ends the attempt can release all of it.
      const release = (): void => {
        clearTimeout(deadline)
        session.signal.removeEventListener('abort', onAbort)
        void dispose()
      }
      const deadline = setTimeout(() => {
        release()
        reject(new EntraSignInError('the sign-in was not completed in time'))
      }, this.config.attemptTimeoutMs)
      const onAbort = (): void => {
        release()
        reject(new EntraSignInError('the sign-in was withdrawn'))
      }
      const dispose = this.ctx.effect(() => this.ctx.webServer.register({
        kind: 'exact',
        path: this.config.redirectPath,
        handler: (req, res) => {
          /* v8 ignore next -- Node always sets `url` on an incoming request; the type allows undefined. */
          const url = new URL(req.url ?? '/', 'http://127.0.0.1')
          const state = url.searchParams.get('state')
          const code = url.searchParams.get('code')
          // One state and one code, and the state must be this attempt's; a
          // request failing any of it is not this attempt's and is told nothing.
          if (req.method !== 'GET' || state === null || code === null
            || url.searchParams.getAll('state').length !== 1
            || url.searchParams.getAll('code').length !== 1
            || !stateMatches(secrets.state, state)) {
            res.writeHead(400, { 'cache-control': 'no-store' }).end()
            return
          }
          release()
          res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
            .end('Signed in. You can close this tab.')
          resolve(code)
        },
      }), 'microsoft-entra: sign-in callback')
      session.signal.addEventListener('abort', onAbort, { once: true })
      session.notify({
        message: 'Sign in to Microsoft Entra ID in your browser, then return here.',
        url: authorizeUrl(this.config, secrets, redirectUri).toString(),
      })
    })
  }

  /** Redeem one authorization code at the token endpoint. */
  private async redeem(
    secrets: AttemptSecrets,
    redirectUri: string,
    code: string,
    signal: AbortSignal,
  ): Promise<TokenResponse> {
    const response = await this.send(
      tokenEndpoint(this.config),
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequestBody(this.config, secrets, redirectUri, code).toString(),
      },
      signal,
    )
    const body: unknown = await response.json()
    if (!response.ok) {
      const refusal = tokenErrorSchema.safeParse(body)
      throw new EntraSignInError(refusal.success
        ? `the directory refused the sign-in: ${refusal.data.error}`
        : `the directory refused the sign-in with status ${String(response.status)}`)
    }
    const parsed = tokenResponseSchema.safeParse(body)
    if (!parsed.success) throw new EntraSignInError('the directory returned a token response this build cannot read')
    return parsed.data
  }

  /** Read the signed-in person from the directory itself. */
  private async readSubject(accessToken: string, signal: AbortSignal): Promise<EntraSubject> {
    const response = await this.send(
      new URL(`${this.config.graphOrigin}/v1.0/me`),
      { headers: { authorization: `Bearer ${accessToken}` } },
      signal,
    )
    if (!response.ok) {
      throw new EntraSignInError(`the directory would not report the signed-in person (status ${String(response.status)})`)
    }
    const parsed = graphMeSchema.safeParse(await response.json())
    if (!parsed.success) throw new EntraSignInError('the directory described the person in a form this build cannot read')
    return subjectFromGraph(parsed.data, this.config.directory)
  }

  /** One bounded request that stops with the attempt. */
  private async send(url: URL, init: RequestInit, signal: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(this.config.requestTimeoutMs)
    return fetch(url, { ...init, signal: AbortSignal.any([signal, timeout]) })
  }
}

export default MicrosoftEntra
