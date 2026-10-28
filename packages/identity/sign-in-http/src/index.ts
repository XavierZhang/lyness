/**
 * The browser-facing half of signing in: four routes and the cookie.
 *
 * It exists because `lyn-sign-in` deliberately stops at the session identity.
 * Something has to decide where the directory returns to, what the cookie's
 * attributes are, and what a refused sign-in looks like to a person rather
 * than to a caller — and all three are properties of being served over HTTP,
 * not of signing in.
 *
 * This is also the only layer that knows a browser is involved, so it is
 * where one sign-in is bound to one browser. Without that binding the
 * callback would accept any state this process issued, including one an
 * attacker obtained by starting their own sign-in and then handing the link
 * to someone else — which signs that person in as the attacker.
 *
 * @module @lyness/lyn-sign-in-http
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { assertNever } from '@lyness/lyn-util-values'
import { brandString } from '@lyness/lyn-brand'
import { sendJson } from '@lyness/lyn-host-webserver'
import type {} from '@lyness/lyn-host-webserver'
import { SignInRefused, channelId } from '@lyness/lyn-sign-in'
import type { ChannelId } from '@lyness/lyn-sign-in'
import type { AuthSessionId } from '@lyness/lyn-auth-session'
import {
  ATTEMPT_COOKIE, SESSION_COOKIE, clearCookie, readCookie, setCookie,
} from './cookie.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'sign-in-http'

/** The sign-in flow, the session store for signing out, and the server to mount on. */
export const inject = ['signIn', 'authSessions', 'webServer']

/** Where a sign-in page asks which channels a deployment offers. */
export const CHANNELS_PATH = '/auth/channels'

/** Prefix a sign-in starts at; the channel id is the next segment. */
export const START_PREFIX = '/auth/sign-in'

/** Prefix a directory returns to; the channel id is the next segment. */
export const CALLBACK_PREFIX = '/auth/callback'

/** Where a browser ends its own session. */
export const SIGN_OUT_PATH = '/auth/sign-out'

/** How long a browser may take to come back from the directory, in seconds. */
export const ATTEMPT_COOKIE_SECONDS = 600

/** Deployment-owned facts about being served over HTTP. */
export interface Config {
  /**
   * The origin a browser reaches this deployment at, with no trailing slash.
   *
   * Required, because the Host cannot know it: behind a proxy the request's
   * own `Host` is the proxy's, and the address a directory returns to has to
   * be the one in the app registration. Guessing it wrong makes every
   * sign-in fail at the directory, with the directory doing the complaining.
   */
  publicOrigin: string
  /**
   * Whether that origin is served over TLS, which decides the cookies' `Secure`.
   *
   * Required and not defaulted either way: `true` silently breaks a
   * plain-HTTP development install, and `false` silently ships a session
   * cookie that travels in the clear. A deployment states which it is.
   */
  secureCookies: boolean
  /** Where a completed sign-in sends the browser. Defaults to the application root. */
  landingPath?: string
}

export const Config: z<Config> = z.object({
  publicOrigin: z.string().pattern(/^https?:\/\/[^\s/]+$/u).required(),
  secureCookies: z.boolean().required(),
  landingPath: z.string().pattern(/^\/\S*$/u).default('/'),
})

/** Resolved terms, with every default applied. */
export interface ResolvedConfig {
  /** The origin a browser reaches this deployment at. */
  readonly publicOrigin: string
  /** Whether the cookies carry `Secure`. */
  readonly secureCookies: boolean
  /** Where a completed sign-in sends the browser. */
  readonly landingPath: string
}

/**
 * Apply the landing default for a config built without the Loader's validation.
 * @param config - validated or hand-built configuration.
 * @returns the terms these routes run on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    publicOrigin: config.publicOrigin,
    secureCookies: config.secureCookies,
    landingPath: config.landingPath ?? '/',
  }
}

/**
 * The channel a request names, from the segment after a prefix.
 * @param pathname - the request's pathname.
 * @param prefix - the route prefix it matched.
 * @returns the channel id, or undefined when the path names none or names more than one.
 */
export function channelFrom(pathname: string, prefix: string): ChannelId | undefined {
  if (!pathname.startsWith(`${prefix}/`)) return undefined
  const rest = pathname.slice(prefix.length + 1)
  if (rest.length === 0 || rest.includes('/')) return undefined
  return channelId(decodeURIComponent(rest))
}

/**
 * The callback address one channel's directory returns to.
 * @param origin - the deployment's public origin.
 * @param channel - the channel being signed in through.
 * @returns the absolute address to pass to the sign-in flow.
 */
export function callbackUrl(origin: string, channel: ChannelId): string {
  return `${origin}${CALLBACK_PREFIX}/${encodeURIComponent(channel)}`
}

/**
 * The HTTP status a refusal is reported with.
 * @param refusal - the refusal the sign-in flow raised.
 * @returns the status to answer the browser with.
 */
export function statusOf(refusal: SignInRefused): number {
  switch (refusal.code) {
    case 'channel-unknown': return 404
    // The caller asked a channel for something it does not do, and the
    // directory never refused anything: that is a bad request, not a denial.
    case 'nothing-to-resume': return 400
    case 'not-authenticated': return 400
    case 'not-admitted': return 403
    default: return assertNever(refusal.code, 'sign-in refusal')
  }
}

/** The request URL as a parsed URL, with the deployment's own origin as the base. */
function requestUrl(req: IncomingMessage, origin: string): URL {
  return new URL(req.url ?? '/', origin)
}

/** Send a redirect, optionally setting cookies with it. */
function redirect(res: ServerResponse, to: string, cookies: readonly string[]): void {
  const headers: Record<string, string | string[]> = { location: to, 'cache-control': 'no-store' }
  if (cookies.length > 0) headers['set-cookie'] = [...cookies]
  res.writeHead(302, headers).end()
}

/** Mount the four routes. */
export function apply(ctx: Context, config: Config): void {
  const terms = resolveConfig(config)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CHANNELS_PATH,
    handler: (req, res) => {
      if (req.method !== 'GET') { sendJson(res, 405, { error: 'method-not-allowed' }); return }
      sendJson(res, 200, { channels: ctx.signIn.available() })
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: START_PREFIX,
    handler: async (req, res) => {
      if (req.method !== 'GET') { sendJson(res, 405, { error: 'method-not-allowed' }); return }
      const channel = channelFrom(requestUrl(req, terms.publicOrigin).pathname, START_PREFIX)
      if (channel === undefined) { sendJson(res, 404, { error: 'channel-unknown' }); return }
      try {
        const outcome = await ctx.signIn.begin(channel, callbackUrl(terms.publicOrigin, channel))
        if (outcome.kind !== 'redirect') {
          // A self-driven channel completes in the process that owns the
          // browser, so a hosted deployment has nowhere to send this person.
          sendJson(res, 400, { error: 'channel-not-browser-driven' })
          return
        }
        redirect(res, outcome.start.to, [setCookie(ATTEMPT_COOKIE, outcome.start.attempt, {
          secure: terms.secureCookies,
          maxAgeSeconds: ATTEMPT_COOKIE_SECONDS,
        })])
      } catch (error) {
        reportRefusal(res, error)
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: CALLBACK_PREFIX,
    handler: async (req, res) => {
      if (req.method !== 'GET') { sendJson(res, 405, { error: 'method-not-allowed' }); return }
      const url = requestUrl(req, terms.publicOrigin)
      const channel = channelFrom(url.pathname, CALLBACK_PREFIX)
      if (channel === undefined) { sendJson(res, 404, { error: 'channel-unknown' }); return }
      const expected = readCookie(req.headers.cookie, ATTEMPT_COOKIE)
      if (expected === undefined || expected !== url.searchParams.get('state')) {
        // This browser did not start this sign-in. Completing it anyway is
        // how a person gets signed in as whoever handed them the link.
        sendJson(res, 400, { error: 'attempt-not-this-browser' })
        return
      }
      try {
        const session = await ctx.signIn.resume(channel, url.searchParams)
        // The cookie's lifetime comes from the session's own, so a browser
        // never holds a credential the server has already let lapse.
        const established = await ctx.authSessions.read(session)
        redirect(res, `${terms.publicOrigin}${terms.landingPath}`, [
          setCookie(SESSION_COOKIE, session, {
            secure: terms.secureCookies,
            maxAgeSeconds: cookieLifetime(established.expiresAt),
          }),
          clearCookie(ATTEMPT_COOKIE, { secure: terms.secureCookies }),
        ])
      } catch (error) {
        reportRefusal(res, error)
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SIGN_OUT_PATH,
    handler: async (req, res) => {
      // POST only, so `SameSite=Lax` withholds the cookie from a cross-site
      // request: a link someone else posted cannot sign this person out.
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'method-not-allowed' }); return }
      const presented = readCookie(req.headers.cookie, SESSION_COOKIE)
      if (presented !== undefined) await ctx.authSessions.revoke(brandString<AuthSessionId>(presented))
      res.writeHead(204, {
        'cache-control': 'no-store',
        'set-cookie': clearCookie(SESSION_COOKIE, { secure: terms.secureCookies }),
      }).end()
    },
  }))
}

/**
 * How long the session cookie should live, from the session's own expiry.
 * @param expiresAt - when the session lapses, or undefined when it does not.
 * @returns whole seconds, or undefined for a cookie the browser drops on close.
 */
export function cookieLifetime(expiresAt: string | undefined): number | undefined {
  if (expiresAt === undefined) return undefined
  const remaining = Date.parse(expiresAt) - Date.now()
  return remaining > 0 ? Math.floor(remaining / 1000) : 0
}

/** Report a sign-in refusal, and let anything else fail as the server's own error. */
function reportRefusal(res: ServerResponse, error: unknown): void {
  if (!(error instanceof SignInRefused)) throw error
  sendJson(res, statusOf(error), { error: error.code })
}
