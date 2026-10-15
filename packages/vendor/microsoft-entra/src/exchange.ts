/**
 * The two network steps that turn an authorization code into a known person.
 *
 * They live apart from the service because both sign-in shapes take them: the
 * operator sign-in that waits on a loopback callback, and the channel a
 * hosted deployment's browser returns to. One copy means one place where a
 * directory's refusal is read and one place where its answer is accepted.
 *
 * @module @lyness/lyn-microsoft-entra/exchange
 */

import {
  graphMeSchema, subjectFromGraph, tokenEndpoint, tokenErrorSchema, tokenRequestBody,
  tokenResponseSchema,
} from './protocol.ts'
import type { AttemptSecrets, TokenResponse } from './protocol.ts'
import type { ResolvedConfig } from './index.ts'
import type { EntraSubject } from './types.ts'

/** Sign-in failed for a reason worth telling the person apart from a crash. */
export class EntraSignInError extends Error {
  /** @param reason - which step refused, in words a surface can show. */
  constructor(reason: string) {
    super(`microsoft-entra: ${reason}`)
    this.name = 'EntraSignInError'
  }
}

/**
 * Redeem one authorization code at the token endpoint.
 * @param config - resolved deployment configuration.
 * @param secrets - the attempt's single-use values, including the PKCE verifier.
 * @param redirectUri - the same URI the authorization request named.
 * @param code - the code the callback received.
 * @param signal - stops the request with the attempt.
 * @returns the directory's tokens.
 * @throws {EntraSignInError} when the directory refuses, or answers in a form this build cannot read.
 */
export async function redeemCode(
  config: ResolvedConfig,
  secrets: AttemptSecrets,
  redirectUri: string,
  code: string,
  signal: AbortSignal,
): Promise<TokenResponse> {
  const response = await send(
    config,
    tokenEndpoint(config),
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody(config, secrets, redirectUri, code).toString(),
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

/**
 * Read the signed-in person from the directory itself.
 * @param config - resolved deployment configuration.
 * @param accessToken - the token the redemption returned.
 * @param signal - stops the request with the attempt.
 * @returns the person the directory reports.
 * @throws {EntraSignInError} when the directory will not report them, or describes them unreadably.
 */
export async function readSubject(
  config: ResolvedConfig,
  accessToken: string,
  signal: AbortSignal,
): Promise<EntraSubject> {
  const response = await send(
    config,
    new URL(`${config.graphOrigin}/v1.0/me`),
    { headers: { authorization: `Bearer ${accessToken}` } },
    signal,
  )
  if (!response.ok) {
    throw new EntraSignInError(`the directory would not report the signed-in person (status ${String(response.status)})`)
  }
  const parsed = graphMeSchema.safeParse(await response.json())
  if (!parsed.success) throw new EntraSignInError('the directory described the person in a form this build cannot read')
  return subjectFromGraph(parsed.data, config.directory)
}

/** One bounded request that stops with the attempt. */
function send(config: ResolvedConfig, url: URL, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(config.requestTimeoutMs)
  return fetch(url, { ...init, signal: AbortSignal.any([signal, timeout]) })
}
