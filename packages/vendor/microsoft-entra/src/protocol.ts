/**
 * The OpenID Connect requests and responses this integration exchanges with
 * Microsoft Entra, as pure functions over validated values.
 *
 * Everything here is I/O-free so the request shapes and the acceptance of a
 * directory's answers are checkable without a network or a browser.
 * @module @lyness/lyn-microsoft-entra/protocol
 */

import { z } from 'zod'
import { brandString } from '@lyness/lyn-brand'
import type { EntraDirectoryId, EntraObjectId, EntraSubject } from './types.ts'
import type { ResolvedConfig } from './index.ts'

/** One attempt's single-use values, bound to the browser round trip. */
export interface AttemptSecrets {
  /** PKCE verifier; only its challenge leaves this process before the exchange. */
  readonly verifier: string
  /** S256 challenge derived from the verifier. */
  readonly challenge: string
  /** Opaque value the callback must echo, compared in constant time. */
  readonly state: string
  /** Replay guard the directory echoes into the id token. */
  readonly nonce: string
}

/**
 * Build the authorization endpoint URL for one attempt.
 *
 * `response_mode=query` keeps the code in the query string, where the loopback
 * callback can read it; the fragment form never reaches a server.
 * @param config - resolved deployment configuration.
 * @param secrets - this attempt's single-use values.
 * @param redirectUri - the exact loopback URI registered for this attempt.
 * @returns the URL to open in the person's browser.
 */
export function authorizeUrl(config: ResolvedConfig, secrets: AttemptSecrets, redirectUri: string): URL {
  const url = new URL(`https://${config.authorityHost}/${config.directory}/oauth2/v2.0/authorize`)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state: secrets.state,
    nonce: secrets.nonce,
    code_challenge: secrets.challenge,
    code_challenge_method: 'S256',
  }).toString()
  return url
}

/**
 * The token endpoint of the configured directory.
 * @param config - resolved deployment configuration.
 * @returns the URL one authorization code is redeemed at.
 */
export function tokenEndpoint(config: ResolvedConfig): URL {
  return new URL(`https://${config.authorityHost}/${config.directory}/oauth2/v2.0/token`)
}

/**
 * Build the token-endpoint form body that redeems one authorization code.
 *
 * The verifier is sent here and nowhere else: it proves this process started
 * the attempt whose challenge the directory recorded.
 * @param config - resolved deployment configuration.
 * @param secrets - this attempt's single-use values.
 * @param redirectUri - the same URI the authorization request named.
 * @param code - the code the callback received.
 * @returns the `application/x-www-form-urlencoded` body.
 */
export function tokenRequestBody(
  config: ResolvedConfig,
  secrets: AttemptSecrets,
  redirectUri: string,
  code: string,
): URLSearchParams {
  return new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: secrets.verifier,
    scope: config.scopes.join(' '),
  })
}

const nonEmpty = z.string().min(1)

/** Accepted token-endpoint success response. Fields this integration does not use are ignored. */
export const tokenResponseSchema = z.object({
  access_token: nonEmpty,
  token_type: nonEmpty,
  expires_in: z.number().int().positive(),
  refresh_token: nonEmpty.optional(),
}).loose()

/** A redeemed authorization code's tokens. */
export type TokenResponse = z.infer<typeof tokenResponseSchema>

/** Accepted token-endpoint failure response, which carries the directory's own reason. */
export const tokenErrorSchema = z.object({
  error: nonEmpty,
  error_description: z.string().optional(),
}).loose()

/**
 * Accepted Microsoft Graph `/me` response.
 *
 * The subject comes from this authenticated call rather than from the id
 * token's claims, so no token signature has to be verified here: the answer is
 * as trustworthy as the TLS connection that returned it, and the directory —
 * not the client — decides what it says.
 */
export const graphMeSchema = z.object({
  id: nonEmpty,
  displayName: z.string().min(1).nullish(),
  userPrincipalName: z.string().min(1).nullish(),
  mail: z.string().min(1).nullish(),
}).loose()

/** A directory's answer about the signed-in person. */
export type GraphMe = z.infer<typeof graphMeSchema>

/**
 * Fold a Graph answer and the directory it came from into one subject.
 * @param me - the validated `/me` answer.
 * @param directoryId - the directory that authenticated the person.
 * @returns the signed-in subject, with absent names omitted rather than blank.
 */
export function subjectFromGraph(me: GraphMe, directoryId: string): EntraSubject {
  const address = me.userPrincipalName ?? me.mail ?? undefined
  return {
    objectId: brandString<EntraObjectId>(me.id),
    directoryId: brandString<EntraDirectoryId>(directoryId),
    ...me.displayName === null || me.displayName === undefined ? {} : { displayName: me.displayName },
    ...address === undefined ? {} : { address },
  }
}
