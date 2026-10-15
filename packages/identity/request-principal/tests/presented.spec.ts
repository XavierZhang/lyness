/**
 * Which bearer identity a request presents.
 *
 * Both forms are read because both callers exist: a browser holds a cookie
 * while a desktop client or a script sends a header, and reading only one
 * would silently leave the other anonymous.
 */

import { expect, it } from 'vitest'
import { IDENTITY_COOKIE, presentedSession } from '../src/index.ts'

/** A request carrying the given headers. */
function requestWith(headers: Record<string, string>): Request {
  return new Request('http://127.0.0.1/api/x', { headers })
}

it('reads a bearer header', () => {
  expect(presentedSession(requestWith({ authorization: 'Bearer abc123' }))).toBe('abc123')
})

it('accepts the scheme in any case, as HTTP allows', () => {
  expect(presentedSession(requestWith({ authorization: 'bearer abc123' }))).toBe('abc123')
})

it('reads the identity cookie', () => {
  expect(presentedSession(requestWith({ cookie: `${IDENTITY_COOKIE}=xyz` }))).toBe('xyz')
})

it('finds the identity cookie beside others', () => {
  expect(presentedSession(requestWith({ cookie: `other=1; ${IDENTITY_COOKIE}=xyz; third=3` })))
    .toBe('xyz')
})

it('prefers the header, so an explicit credential beats an ambient one', () => {
  const request = requestWith({ authorization: 'Bearer header', cookie: `${IDENTITY_COOKIE}=cookie` })
  expect(presentedSession(request)).toBe('header')
})

it('keeps a value containing an equals sign intact', () => {
  expect(presentedSession(requestWith({ cookie: `${IDENTITY_COOKIE}=a=b` }))).toBe('a=b')
})

it('presents nothing for a request carrying neither', () => {
  expect(presentedSession(requestWith({}))).toBeUndefined()
})

it('presents nothing for an empty or malformed credential', () => {
  expect(presentedSession(requestWith({ authorization: 'Bearer' }))).toBeUndefined()
  expect(presentedSession(requestWith({ authorization: 'Basic abc' }))).toBeUndefined()
  expect(presentedSession(requestWith({ cookie: `${IDENTITY_COOKIE}=` }))).toBeUndefined()
  expect(presentedSession(requestWith({ cookie: 'unrelated=1' }))).toBeUndefined()
})
