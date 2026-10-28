/**
 * The requests and replies this integration exchanges with WeCom, as pure
 * functions over validated values.
 *
 * Everything here is I/O-free so the request shapes and the acceptance of the
 * corporation's answers are checkable without a network or a browser.
 *
 * WeCom answers every call with HTTP 200 and reports failure in the body's
 * `errcode`, so each reply is validated and then checked for a zero code; a
 * reader that trusted the status would treat every refusal as a success.
 *
 * @module @deepseek-ai/dsh-wecom/protocol
 */

import { z } from 'zod'
import type { ResolvedConfig } from './index.ts'

/** The envelope every WeCom reply carries. */
const envelope = {
  errcode: z.number(),
  errmsg: z.string(),
}

/** What `gettoken` answers: the application's own token for this corporation. */
export const tokenReplySchema = z.object({
  ...envelope,
  access_token: z.string().optional(),
  expires_in: z.number().optional(),
}).loose()

/**
 * What `auth/getuserinfo` answers.
 *
 * `userid` is present for a member of this corporation; a reply carrying only
 * `openid` is somebody who authenticated through WeChat without being in the
 * directory, and there is no corporation identity to bind them to.
 */
export const userInfoReplySchema = z.object({
  ...envelope,
  userid: z.string().optional(),
  user_ticket: z.string().optional(),
  openid: z.string().optional(),
}).loose()

/** What `auth/getuserdetail` answers for a member who granted private detail. */
export const userDetailReplySchema = z.object({
  ...envelope,
  userid: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  biz_mail: z.string().optional(),
}).loose()

/** One WeCom reply, as this integration reads it. */
export type TokenReply = z.infer<typeof tokenReplySchema>

/** One member-identity reply. */
export type UserInfoReply = z.infer<typeof userInfoReplySchema>

/** One member-detail reply. */
export type UserDetailReply = z.infer<typeof userDetailReplySchema>

/**
 * Build the page the browser is sent to.
 *
 * The scan-code login host rather than the in-client OAuth endpoint: a
 * deployment reached from a browser is the case a server can serve, and the
 * in-client form only completes inside the WeCom application itself.
 * @param config - resolved deployment configuration.
 * @param state - the opaque value the callback must echo.
 * @param redirectUri - the exact callback this attempt named.
 * @returns the URL to send the browser to.
 */
export function authorizeUrl(config: ResolvedConfig, state: string, redirectUri: string): URL {
  const url = new URL(`https://${config.loginHost}/wwlogin/sso/login`)
  url.search = new URLSearchParams({
    login_type: 'CorpApp',
    appid: config.corpId,
    agentid: config.agentId,
    redirect_uri: redirectUri,
    state,
  }).toString()
  return url
}

/**
 * Build the application-token request.
 *
 * The secret is a query parameter because that is the only form this endpoint
 * accepts; it never leaves the deployment's own outbound request.
 * @param config - resolved deployment configuration.
 * @param secret - the application secret, resolved from the credential store.
 * @returns the URL to request.
 */
export function tokenUrl(config: ResolvedConfig, secret: string): URL {
  const url = new URL('/cgi-bin/gettoken', config.apiOrigin)
  url.search = new URLSearchParams({ corpid: config.corpId, corpsecret: secret }).toString()
  return url
}

/**
 * Build the member-identity request for one authorization code.
 * @param config - resolved deployment configuration.
 * @param token - the application token.
 * @param code - the code the callback carried.
 * @returns the URL to request.
 */
export function userInfoUrl(config: ResolvedConfig, token: string, code: string): URL {
  const url = new URL('/cgi-bin/auth/getuserinfo', config.apiOrigin)
  url.search = new URLSearchParams({ access_token: token, code }).toString()
  return url
}

/**
 * Build the member-detail request.
 * @param config - resolved deployment configuration.
 * @param token - the application token.
 * @returns the URL to post to.
 */
export function userDetailUrl(config: ResolvedConfig, token: string): URL {
  const url = new URL('/cgi-bin/auth/getuserdetail', config.apiOrigin)
  url.search = new URLSearchParams({ access_token: token }).toString()
  return url
}

/** The code a successful WeCom reply carries. */
export const OK = 0
