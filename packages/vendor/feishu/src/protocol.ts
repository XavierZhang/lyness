/**
 * The requests and replies this integration exchanges with Feishu, as pure
 * functions over validated values.
 *
 * Everything here is I/O-free so the request shapes and the acceptance of the
 * tenant's answers are checkable without a network or a browser.
 *
 * Feishu answers with HTTP 200 and reports failure in the body's `code`, like
 * WeCom; unlike WeCom it nests the payload under `data` on the two endpoints
 * that have one, so each reply is validated against the shape that endpoint
 * actually sends rather than against one envelope for all three.
 *
 * @module @lyness/lyn-feishu/protocol
 */

import { z } from 'zod'
import type { ResolvedConfig } from './index.ts'

/** The envelope every Feishu reply carries. */
const envelope = {
  code: z.number(),
  msg: z.string(),
}

/** What `app_access_token_internal` answers: the application's own token, beside the envelope. */
export const appTokenReplySchema = z.object({
  ...envelope,
  app_access_token: z.string().optional(),
  expire: z.number().optional(),
}).loose()

/** What `oidc/access_token` answers: the person's own token, nested under `data`. */
export const userTokenReplySchema = z.object({
  ...envelope,
  data: z.object({
    access_token: z.string(),
    expires_in: z.number().optional(),
  }).loose().optional(),
}).loose()

/** What `user_info` answers: who that token belongs to, nested under `data`. */
export const userInfoReplySchema = z.object({
  ...envelope,
  data: z.object({
    union_id: z.string(),
    open_id: z.string().optional(),
    tenant_key: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    enterprise_email: z.string().optional(),
  }).loose().optional(),
}).loose()

/** One application-token reply. */
export type AppTokenReply = z.infer<typeof appTokenReplySchema>

/** One person-token reply. */
export type UserTokenReply = z.infer<typeof userTokenReplySchema>

/** One person reply. */
export type UserInfoReply = z.infer<typeof userInfoReplySchema>

/** The code a successful Feishu reply carries. */
export const OK = 0

/**
 * Build the page the browser is sent to.
 * @param config - resolved deployment configuration.
 * @param state - the opaque value the callback must echo.
 * @param redirectUri - the exact callback this attempt named.
 * @returns the URL to send the browser to.
 */
export function authorizeUrl(config: ResolvedConfig, state: string, redirectUri: string): URL {
  const url = new URL('/open-apis/authen/v1/authorize', config.apiOrigin)
  url.search = new URLSearchParams({
    app_id: config.appId,
    redirect_uri: redirectUri,
    state,
  }).toString()
  return url
}

/**
 * Build the application-token request.
 *
 * The internal form, because a deployment signs in its own tenant's people
 * with its own application; the marketplace form would need a ticket this
 * integration never receives.
 * @param config - resolved deployment configuration.
 * @param secret - the application secret, resolved from the credential store.
 * @returns the endpoint and the JSON body to post.
 */
export function appTokenRequest(config: ResolvedConfig, secret: string): {
  url: URL
  body: Record<string, string>
} {
  return {
    url: new URL('/open-apis/auth/v3/app_access_token_internal', config.apiOrigin),
    body: { app_id: config.appId, app_secret: secret },
  }
}

/**
 * Build the person-token request for one authorization code.
 * @param config - resolved deployment configuration.
 * @param appToken - the application's own token, which authorizes the exchange.
 * @param code - the code the callback carried.
 * @returns the endpoint, the authorization header, and the JSON body to post.
 */
export function userTokenRequest(config: ResolvedConfig, appToken: string, code: string): {
  url: URL
  headers: Record<string, string>
  body: Record<string, string>
} {
  return {
    url: new URL('/open-apis/authen/v1/oidc/access_token', config.apiOrigin),
    headers: { authorization: `Bearer ${appToken}` },
    body: { grant_type: 'authorization_code', code },
  }
}

/**
 * Build the request that reads who one person token belongs to.
 * @param config - resolved deployment configuration.
 * @param userToken - the person's own access token.
 * @returns the endpoint and the authorization header.
 */
export function userInfoRequest(config: ResolvedConfig, userToken: string): {
  url: URL
  headers: Record<string, string>
} {
  return {
    url: new URL('/open-apis/authen/v1/user_info', config.apiOrigin),
    headers: { authorization: `Bearer ${userToken}` },
  }
}
