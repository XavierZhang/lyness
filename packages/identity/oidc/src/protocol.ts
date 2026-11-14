/**
 * The requests and replies this integration exchanges with an OpenID
 * Provider, as pure functions over validated values.
 *
 * Everything here is I/O-free, so the request shapes and the acceptance of a
 * provider's answers are checkable without a network or a browser.
 *
 * Only three endpoints are used, and all three come from the provider's own
 * discovery document rather than from configuration: a deployment that wrote
 * them itself could point the token exchange at one host and the
 * authorization at another, which is the shape of a code-theft attack.
 *
 * @module @lyness/lyn-oidc/protocol
 */

import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { ResolvedConfig } from './index.ts'

/** The discovery fields this integration needs, of the many a provider publishes. */
export const discoverySchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  userinfo_endpoint: z.string(),
}).loose()

/** What the token endpoint answers on success. */
export const tokenReplySchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
}).loose()

/**
 * The userinfo claims this integration reads.
 *
 * `sub` alone is required: everything else is a claim a provider may or may
 * not publish, and a sign-in that demanded a name would refuse a person whose
 * directory holds none.
 */
export const userinfoReplySchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  email: z.string().optional(),
}).loose()

/** What a refusal carries, whatever the endpoint. */
export const failureSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
}).loose()

/** One provider's discovery document, as this integration reads it. */
export type Discovery = z.infer<typeof discoverySchema>

/** One token reply. */
export type TokenReply = z.infer<typeof tokenReplySchema>

/** One userinfo reply. */
export type UserinfoReply = z.infer<typeof userinfoReplySchema>

/**
 * Where a provider publishes its discovery document.
 * @param issuer - the issuer identifier, with or without a trailing slash.
 * @returns the discovery document's URL under it.
 */
export function discoveryUrl(issuer: string): URL {
  return new URL('.well-known/openid-configuration', issuer.endsWith('/') ? issuer : `${issuer}/`)
}

/**
 * A fresh PKCE verifier.
 *
 * Held with its own attempt rather than derived from anything, because the
 * attempt book already carries what one sign-in must remember and two
 * sign-ins in flight must not share a value.
 * @returns 43 characters of base64url, as PKCE wants.
 */
export function newVerifier(): string {
  return base64Url(randomBytes(32))
}

/**
 * The S256 challenge of one verifier.
 * @param verifier - the attempt's verifier.
 * @returns the challenge the authorization request carries.
 */
export function challengeOf(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

/** base64url without padding, as PKCE and JOSE spell it. */
function base64Url(data: Buffer): string {
  return data.toString('base64url')
}

/**
 * Where to send the browser for one attempt.
 * @param discovery - the provider's own endpoints.
 * @param config - this channel's resolved configuration.
 * @param state - the attempt's opaque value, echoed back by the provider.
 * @param challenge - the attempt's PKCE challenge.
 * @param returnTo - the callback the provider returns the browser to.
 * @returns the provider's authorization page.
 */
export function authorizeUrl(
  discovery: Discovery,
  config: ResolvedConfig,
  state: string,
  challenge: string,
  returnTo: string,
): URL {
  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', returnTo)
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (config.organizationParameter !== undefined && config.organization !== undefined) {
    url.searchParams.set(config.organizationParameter, config.organization)
  }
  return url
}

/**
 * The token exchange for one authorization code.
 *
 * The client authenticates in the body rather than with Basic: every provider
 * accepts `client_secret_post`, and not every one accepts both.
 * @param discovery - the provider's own endpoints.
 * @param config - this channel's resolved configuration.
 * @param secret - the resolved application secret.
 * @param code - the code the callback carried.
 * @param verifier - the attempt's PKCE verifier.
 * @param returnTo - the callback the authorization request named.
 * @returns the endpoint and the form body to post to it.
 */
export function tokenRequest(
  discovery: Discovery,
  config: ResolvedConfig,
  secret: string,
  code: string,
  verifier: string,
  returnTo: string,
): { readonly url: URL; readonly body: URLSearchParams } {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', returnTo)
  body.set('client_id', config.clientId)
  body.set('client_secret', secret)
  body.set('code_verifier', verifier)
  return { url: new URL(discovery.token_endpoint), body }
}

/**
 * The userinfo read for one access token.
 * @param discovery - the provider's own endpoints.
 * @param token - the access token the exchange returned.
 * @returns the endpoint and the bearer header to read it with.
 */
export function userinfoRequest(
  discovery: Discovery,
  token: string,
): { readonly url: URL; readonly headers: Record<string, string> } {
  return { url: new URL(discovery.userinfo_endpoint), headers: { authorization: `Bearer ${token}` } }
}

/**
 * The organization one userinfo reply names, under the claim a deployment chose.
 *
 * Read from the raw reply rather than from the parsed shape, because the
 * claim's name is a deployment's choice and its value may be nested one level
 * the way `organization.id` is.
 * @param reply - the userinfo payload as the provider sent it.
 * @param claim - the claim path, with `.` separating one level.
 * @returns the organization, or undefined when the claim is absent or not a string.
 */
export function organizationOf(reply: unknown, claim: string | undefined): string | undefined {
  if (claim === undefined) return undefined
  let value: unknown = reply
  for (const step of claim.split('.')) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[step]
  }
  return typeof value === 'string' && value !== '' ? value : undefined
}
