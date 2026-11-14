import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_IDENTITY, attributionHeaders, userAgent } from '@lyness/lyn-llm'
import type { AppIdentity } from '@lyness/lyn-llm'

// The default identity must not depend on the developer's exported suffix.
beforeEach(() => { vi.stubEnv('LYNESS_USER_AGENT_SUFFIX', undefined) })
afterEach(() => { vi.unstubAllEnvs() })

const manifest = createRequire(import.meta.url)('../package.json') as { version: string }

/** A white-label identity exercising every override hook. */
const forkIdentity: AppIdentity = {
  product: 'fork-agent',
  version: '9.9.9',
  url: 'https://example.com/fork-agent',
}

describe('APP_IDENTITY', () => {
  it('sources the version from the package manifest, never a hand-copied constant', () => {
    expect(APP_IDENTITY.version).toBe(manifest.version)
  })

  it('carries only static public product facts', () => {
    expect(APP_IDENTITY).toEqual({
      product: 'lyness',
      version: manifest.version,
      url: 'https://github.com/XavierZhang/lyness',
    })
  })
})

describe('userAgent', () => {
  it('renders product/version with the +url comment', () => {
    expect(userAgent()).toBe(
      `lyness/${manifest.version} (+https://github.com/XavierZhang/lyness)`,
    )
  })

  it('renders a custom identity', () => {
    expect(userAgent(forkIdentity)).toBe('fork-agent/9.9.9 (+https://example.com/fork-agent)')
  })

  it('appends the identity suffix after the comment', () => {
    expect(userAgent({ ...forkIdentity, suffix: 'lyn-profile/web' })).toBe('fork-agent/9.9.9 (+https://example.com/fork-agent) lyn-profile/web')
  })
})

describe('LYNESS_USER_AGENT_SUFFIX', () => {
  it('appends the launch suffix to the default User-Agent when read', () => {
    vi.stubEnv('LYNESS_USER_AGENT_SUFFIX', 'lyn-profile/my%20web')
    expect(APP_IDENTITY.suffix).toBe('lyn-profile/my%20web')
    expect(userAgent()).toBe(`lyness/${manifest.version} (+https://github.com/XavierZhang/lyness) lyn-profile/my%20web`)
  })

  it.each(['', undefined])('omits the suffix when it is %j', (value) => {
    vi.stubEnv('LYNESS_USER_AGENT_SUFFIX', value)
    expect(APP_IDENTITY.suffix).toBeUndefined()
    expect(userAgent()).toBe(`lyness/${manifest.version} (+https://github.com/XavierZhang/lyness)`)
  })

  it.each(['lyn-profile/my web', 'lyn-profile/web\r\nx-injected: 1', 'lyn-profile/(web)', 'lyn-profile/a/b'])('rejects %j', (value) => {
    vi.stubEnv('LYNESS_USER_AGENT_SUFFIX', value)
    expect(() => userAgent()).toThrow('LYNESS_USER_AGENT_SUFFIX must be an RFC 9110 product token')
  })
})

describe('attributionHeaders', () => {
  it('defaults to the provider-neutral baseline: User-Agent and nothing else', () => {
    expect(attributionHeaders()).toEqual({ 'user-agent': userAgent() })
  })

  it('maps a custom identity onto the User-Agent header only', () => {
    expect(attributionHeaders(forkIdentity)).toEqual({
      'user-agent': 'fork-agent/9.9.9 (+https://example.com/fork-agent)',
    })
  })
})
