/**
 * The attributes a sign-in cookie carries, and how one is read back.
 */

import { describe, expect, it } from 'vitest'
import { ATTEMPT_COOKIE, SESSION_COOKIE, clearCookie, readCookie, setCookie } from '../src/cookie.ts'

describe('setCookie', () => {
  it('keeps the value out of scripts and off cross-site requests', () => {
    const header = setCookie(SESSION_COOKIE, 'abc', { secure: true })
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Path=/')
  })

  it('carries Secure exactly when the deployment is served over TLS', () => {
    expect(setCookie(SESSION_COOKIE, 'abc', { secure: true })).toContain('; Secure')
    expect(setCookie(SESSION_COOKIE, 'abc', { secure: false })).not.toContain('Secure')
  })

  it('writes a lifetime only when one is given', () => {
    expect(setCookie(ATTEMPT_COOKIE, 'a1', { secure: false, maxAgeSeconds: 600 }))
      .toContain('Max-Age=600')
    expect(setCookie(ATTEMPT_COOKIE, 'a1', { secure: false })).not.toContain('Max-Age')
  })

  it('escapes a value so a crafted identity cannot add attributes', () => {
    const header = setCookie(SESSION_COOKIE, 'a; Domain=evil.example', { secure: false })
    expect(header).not.toContain('Domain=')
    expect(readCookie(header.split('; ')[0], SESSION_COOKIE)).toBe('a; Domain=evil.example')
  })
})

describe('clearCookie', () => {
  it('repeats the attributes a browser matches the removal by', () => {
    const header = clearCookie(SESSION_COOKIE, { secure: true })
    expect(header).toBe(`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`)
  })
})

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    expect(readCookie(`other=1; ${SESSION_COOKIE}=abc; last=2`, SESSION_COOKIE)).toBe('abc')
  })

  it('answers nothing when the request sent no cookies', () => {
    expect(readCookie(undefined, SESSION_COOKIE)).toBeUndefined()
  })

  it('answers nothing when the header carries no such cookie', () => {
    expect(readCookie('other=1', SESSION_COOKIE)).toBeUndefined()
  })

  it('does not match a cookie whose name merely ends with the one asked for', () => {
    expect(readCookie(`not_${SESSION_COOKIE}=abc`, SESSION_COOKIE)).toBeUndefined()
  })

  it('ignores a malformed pair with no value', () => {
    expect(readCookie(`broken; ${SESSION_COOKIE}=abc`, SESSION_COOKIE)).toBe('abc')
  })

  it('decodes a value that was escaped on the way out', () => {
    expect(readCookie(`${SESSION_COOKIE}=a%3B%20b`, SESSION_COOKIE)).toBe('a; b')
  })
})
