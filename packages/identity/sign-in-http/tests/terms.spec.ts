/**
 * The decisions these routes make before any I/O: what the deployment's terms
 * default to, which channel a path names, where a directory returns to, which
 * status a refusal is reported with, and how long the session cookie lives.
 */

import { describe, expect, it } from 'vitest'
import { channelId, SignInRefused } from '@deepseek-ai/dsh-sign-in'
import {
  CALLBACK_PREFIX, callbackUrl, channelFrom, cookieLifetime, resolveConfig, START_PREFIX, statusOf,
} from '../src/index.ts'

const ORIGIN = 'https://acme.example'

describe('the terms a deployment is served on', () => {
  it('keeps what the deployment configured', () => {
    expect(resolveConfig({ publicOrigin: ORIGIN, secureCookies: true, landingPath: '/workspace' }))
      .toEqual({ publicOrigin: ORIGIN, secureCookies: true, landingPath: '/workspace' })
  })

  it('lands on the root when no path is named', () => {
    // A deployment that serves the product at its origin names no landing
    // path, and a signed-in browser still has to be sent somewhere.
    expect(resolveConfig({ publicOrigin: ORIGIN, secureCookies: false }))
      .toEqual({ publicOrigin: ORIGIN, secureCookies: false, landingPath: '/' })
  })
})

describe('the channel a path names', () => {
  it('reads the one segment after the prefix, decoded', () => {
    expect(channelFrom(`${START_PREFIX}/wecom`, START_PREFIX)).toBe(channelId('wecom'))
    expect(channelFrom(`${START_PREFIX}/head%20office`, START_PREFIX)).toBe(channelId('head office'))
  })

  it('names none for a path outside the prefix, bare, or carrying more segments', () => {
    // The prefix route matches on a prefix, so the handler sees paths that
    // only start like one of its own; naming no channel is a 404 rather than
    // a channel id assembled out of the wrong path.
    expect(channelFrom('/auth/sign-in-elsewhere/wecom', START_PREFIX)).toBeUndefined()
    expect(channelFrom('/elsewhere/wecom', START_PREFIX)).toBeUndefined()
    expect(channelFrom(START_PREFIX, START_PREFIX)).toBeUndefined()
    expect(channelFrom(`${START_PREFIX}/`, START_PREFIX)).toBeUndefined()
    expect(channelFrom(`${START_PREFIX}/wecom/extra`, START_PREFIX)).toBeUndefined()
  })

  it('is the same channel the callback address carries back', () => {
    const address = callbackUrl(ORIGIN, channelId('head office'))
    expect(address).toBe(`${ORIGIN}${CALLBACK_PREFIX}/head%20office`)
    expect(channelFrom(new URL(address).pathname, CALLBACK_PREFIX)).toBe(channelId('head office'))
  })
})

describe('the status a refusal is reported with', () => {
  it('separates an unknown channel, a bad request, and a denial', () => {
    expect(statusOf(new SignInRefused('channel-unknown'))).toBe(404)
    // Asking a channel for something it does not do is the caller's mistake,
    // not the directory denying anybody.
    expect(statusOf(new SignInRefused('nothing-to-resume'))).toBe(400)
    expect(statusOf(new SignInRefused('not-authenticated'))).toBe(400)
    expect(statusOf(new SignInRefused('not-admitted'))).toBe(403)
  })

  it('refuses to invent a status for a refusal it does not know', () => {
    // The union is closed, so a new refusal has to come here and be decided
    // rather than defaulting into one of the four a browser already sees.
    expect(() => statusOf({ code: 'invented-refusal' } as never)).toThrow('sign-in refusal')
  })
})

describe('how long the session cookie lives', () => {
  it('drops on close when the session itself does not lapse', () => {
    expect(cookieLifetime(undefined)).toBeUndefined()
  })

  it('carries the whole seconds left, and zero for one that already lapsed', () => {
    const lifetime = cookieLifetime(new Date(Date.now() + 90_000).toISOString())
    expect(lifetime).toBeGreaterThan(80)
    expect(lifetime).toBeLessThanOrEqual(90)
    // Already lapsed: zero removes the cookie instead of asking the browser to
    // keep it for a negative time, which a browser reads as a session cookie.
    expect(cookieLifetime(new Date(Date.now() - 1_000).toISOString())).toBe(0)
  })
})
