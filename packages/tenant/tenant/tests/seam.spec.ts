/** Contract behavior the seam itself owns: registration identity, id syntax, and typed refusal. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { isTenantSlug, TenantDirectory, TenantError, TenantId } from '../src/index.ts'
import type { Tenant } from '../src/index.ts'

/** Minimal concrete directory: all a subclass owes the abstract class is the three lookups. */
class StubDirectory extends TenantDirectory {
  private readonly only: Tenant = { id: TenantId('acme'), slug: 'acme', displayName: 'Acme' }

  get(id: Tenant['id']): Promise<Tenant | undefined> {
    return Promise.resolve(id === this.only.id ? this.only : undefined)
  }

  byHost(hostname: string): Promise<Tenant | undefined> {
    return Promise.resolve(hostname === 'acme.example.com' ? this.only : undefined)
  }

  bySlug(slug: string): Promise<Tenant | undefined> {
    return Promise.resolve(slug === this.only.slug ? this.only : undefined)
  }
}

describe('TenantDirectory seam', () => {
  it('registers a subclass as ctx.tenants and leaves with its fiber', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(StubDirectory)
    await fiber.await()
    const directory = ctx.get('tenants')
    expect(directory).toBeInstanceOf(StubDirectory)
    expect(await directory!.get(TenantId('acme'))).toMatchObject({ slug: 'acme', displayName: 'Acme' })
    expect(await directory!.byHost('acme.example.com')).toBeDefined()
    expect(await directory!.bySlug('acme')).toBeDefined()
    await fiber.dispose()
    expect(ctx.get('tenants')).toBeUndefined()
  })

  it('answers undefined for an unknown subject instead of throwing', async () => {
    const ctx = new Context()
    await ctx.plugin(StubDirectory).await()
    const directory = ctx.get('tenants')!
    expect(await directory.get(TenantId('other'))).toBeUndefined()
    expect(await directory.byHost('other.example.com')).toBeUndefined()
    expect(await directory.bySlug('other')).toBeUndefined()
  })
})

describe('TenantId', () => {
  it('brands an id a header, a path segment, and a storage key all carry verbatim', () => {
    expect(TenantId('acme')).toBe('acme')
    expect(TenantId('01J9Z4T7-_x')).toBe('01J9Z4T7-_x')
    expect(TenantId('a'.repeat(64))).toHaveLength(64)
  })

  it('refuses an id that would need escaping, and an empty or overlong one', () => {
    for (const id of ['', ' ', '-acme', 'acme corp', 'acme/../root', 'acmé', 'a'.repeat(65)]) {
      expect(() => TenantId(id)).toThrow(TypeError)
    }
  })
})

describe('isTenantSlug', () => {
  it('accepts one lowercase DNS label and refuses anything a subdomain cannot be', () => {
    expect(isTenantSlug('acme')).toBe(true)
    expect(isTenantSlug('acme-corp')).toBe(true)
    for (const slug of ['', 'Acme', 'acme.corp', '-acme', 'acme-', 'a'.repeat(64)]) {
      expect(isTenantSlug(slug)).toBe(false)
    }
  })
})

describe('TenantError', () => {
  it('carries the business code', () => {
    const failure = new TenantError('unknown-tenant', 'no tenant serves acme.example.com')
    expect(failure.name).toBe('TenantError')
    expect(failure.code).toBe('unknown-tenant')
    expect(failure).toBeInstanceOf(Error)
  })
})
