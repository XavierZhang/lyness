/**
 * The two cookies a browser sign-in sets, and how they are read back.
 *
 * Attributes are built here rather than at each `Set-Cookie` so the session
 * cookie and the attempt cookie cannot drift apart on the ones that matter:
 * both are `HttpOnly`, both are `SameSite=Lax`, and both carry `Secure`
 * exactly when the deployment says it is served over TLS.
 *
 * @module @lyness/lyn-sign-in-http/cookie
 */

/** The cookie holding the signed-in session; `lyn-request-principal` reads it. */
export const SESSION_COOKIE = 'lyn_identity'

/** The cookie binding one sign-in attempt to the browser that started it. */
export const ATTEMPT_COOKIE = 'lyn_signin_attempt'

/** How one cookie is written. */
export interface CookieTerms {
  /** Whether the deployment is served over TLS, which decides `Secure`. */
  readonly secure: boolean
  /** Lifetime in seconds; absent writes a session cookie the browser drops on close. */
  readonly maxAgeSeconds?: number | undefined
}

/**
 * Build one `Set-Cookie` value.
 *
 * `SameSite=Lax` rather than `Strict` because the callback is a top-level
 * navigation the directory sends the browser on: `Strict` would withhold the
 * attempt cookie exactly when it is needed, and the sign-in would never
 * complete.
 * @param name - the cookie's name.
 * @param value - the cookie's value, already opaque.
 * @param terms - TLS and lifetime.
 * @returns the header value to send.
 */
export function setCookie(name: string, value: string, terms: CookieTerms): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (terms.secure) parts.push('Secure')
  if (terms.maxAgeSeconds !== undefined) parts.push(`Max-Age=${String(terms.maxAgeSeconds)}`)
  return parts.join('; ')
}

/**
 * Build the `Set-Cookie` value that removes one cookie.
 *
 * The attributes have to repeat, because a browser matches the cookie to
 * delete by name, path and domain; a bare expiry would leave the original in
 * place.
 * @param name - the cookie to remove.
 * @param terms - TLS, so the removal matches the cookie that was set.
 * @returns the header value to send.
 */
export function clearCookie(name: string, terms: Pick<CookieTerms, 'secure'>): string {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (terms.secure) parts.push('Secure')
  return parts.join('; ')
}

/**
 * Read one cookie from a request's `Cookie` header.
 * @param header - the raw header, or undefined when the request sent none.
 * @param name - the cookie to read.
 * @returns its value, or undefined when the header carries no such cookie.
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  for (const pair of header.split(';')) {
    const at = pair.indexOf('=')
    if (at < 0) continue
    if (pair.slice(0, at).trim() !== name) continue
    return decodeURIComponent(pair.slice(at + 1).trim())
  }
  return undefined
}
