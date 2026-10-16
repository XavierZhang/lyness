/**
 * The requests and replies this integration exchanges with DingTalk, as pure
 * functions over validated values.
 *
 * Everything here is I/O-free so the request shapes and the acceptance of the
 * organization's answers are checkable without a network or a browser.
 *
 * Unlike WeCom, DingTalk reports a refusal with an HTTP status and a body
 * carrying `code` and `message`, so a reader checks the status first and then
 * reads the body for what to say about it.
 *
 * @module @lyness/lyn-dingtalk/protocol
 */

import { z } from 'zod'
import type { ResolvedConfig } from './index.ts'

/** What `userAccessToken` answers: the person's own token, and whose organization they are in. */
export const tokenReplySchema = z.object({
  accessToken: z.string(),
  expireIn: z.number().optional(),
  corpId: z.string().optional(),
}).loose()

/** What `contact/users/me` answers. */
export const userReplySchema = z.object({
  unionId: z.string(),
  openId: z.string().optional(),
  nick: z.string().optional(),
  email: z.string().optional(),
}).loose()

/** What a refusal carries, whatever the endpoint. */
export const failureSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
}).loose()

/** One token reply, as this integration reads it. */
export type TokenReply = z.infer<typeof tokenReplySchema>

/** One person reply. */
export type UserReply = z.infer<typeof userReplySchema>

/**
 * Build the page the browser is sent to.
 * @param config - resolved deployment configuration.
 * @param state - the opaque value the callback must echo.
 * @param redirectUri - the exact callback this attempt named.
 * @returns the URL to send the browser to.
 */
export function authorizeUrl(config: ResolvedConfig, state: string, redirectUri: string): URL {
  const url = new URL('/oauth2/auth', `https://${config.loginHost}`)
  url.search = new URLSearchParams({
    client_id: config.appKey,
    response_type: 'code',
    scope: config.scope,
    redirect_uri: redirectUri,
    state,
    prompt: 'consent',
  }).toString()
  return url
}

/**
 * Build the person-token request for one authorization code.
 * @param config - resolved deployment configuration.
 * @param secret - the application secret, resolved from the credential store.
 * @param code - the code the callback carried.
 * @returns the endpoint and the JSON body to post.
 */
export function tokenRequest(config: ResolvedConfig, secret: string, code: string): {
  url: URL
  body: Record<string, string>
} {
  return {
    url: new URL('/v1.0/oauth2/userAccessToken', config.apiOrigin),
    body: { clientId: config.appKey, clientSecret: secret, code, grantType: 'authorization_code' },
  }
}

/**
 * Build the request that reads who one person token belongs to.
 *
 * `me` rather than a directory lookup by id: the token is the person's own, so
 * the organization answers about them without this deployment naming anybody.
 * @param config - resolved deployment configuration.
 * @param token - the person's access token.
 * @returns the endpoint and the header that carries the token.
 */
export function userRequest(config: ResolvedConfig, token: string): {
  url: URL
  headers: Record<string, string>
} {
  return {
    url: new URL('/v1.0/contact/users/me', config.apiOrigin),
    headers: { 'x-acs-dingtalk-access-token': token },
  }
}
