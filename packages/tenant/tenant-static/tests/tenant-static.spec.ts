/** What an operator's roster produces: the three lookups, and every refusal a malformed roster causes. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { TenantId } from '@lyness/lyn-tenant'
import StaticTenantDirectory from '../src/index.ts'
import type { Config, TenantEntry } from '../src/index.ts'

const ACME: TenantEntry = { id: 'acme', slug: 'acme', displayName: 'Acme', hosts: ['acme.example.com', 'Acme.COM'] }
const GLOBEX: TenantEntry = { id: 'globex-01', slug: 'globex', displayName: 'Globex' }

/**
 * Mount the directory over a roster.
 * @param tenants - the configured rows.
 * @returns the mounted directory.
 */
async function directory(tenants: TenantEntry[]): Promise<StaticTenantDirectory> {
  const ctx = new Context()
  await ctx.plugin(StaticTenantDirectory, { tenants } satisfies Config).await()
  return ctx.get('tenants') as StaticTenantDirectory
}

/**
 * Run a roster expected to be refused, and report the refusal message.
 * @param tenants - the configured rows.
 * @returns the message, or undefined when the roster was accepted.
 */
async function refusal(tenants: TenantEntry[]): Promise<string | undefined> {
  try {
    await directory(tenants)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return undefined
}

describe('static tenant directory', () => {
  it('answers each lookup from the roster, matching hostnames case-insensitively', async () => {
    const tenants = await directory([ACME, GLOBEX])
    expect(await tenants.get(TenantId('acme'))).toEqual({ id: 'acme', slug: 'acme', displayName: 'Acme' })
    expect(await tenants.byHost('acme.example.com')).toMatchObject({ id: 'acme' })
    expect(await tenants.byHost('acme.com')).toMatchObject({ id: 'acme' })
    expect(await tenants.bySlug('globex')).toMatchObject({ id: 'globex-01' })
  })

  it('answers undefined for a subject no row claims', async () => {
    const tenants = await directory([ACME])
    expect(await tenants.get(TenantId('globex'))).toBeUndefined()
    expect(await tenants.byHost('globex.example.com')).toBeUndefined()
    expect(await tenants.bySlug('globex')).toBeUndefined()
  })

  it('leaves with its fiber', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(StaticTenantDirectory, { tenants: [ACME] } satisfies Config)
    await fiber.await()
    expect(ctx.get('tenants')).toBeInstanceOf(StaticTenantDirectory)
    await fiber.dispose()
    expect(ctx.get('tenants')).toBeUndefined()
  })

  it('refuses a roster that names no tenant', async () => {
    expect(await refusal([])).toMatch(/names no tenant/u)
  })

  it('refuses a malformed row, naming its position', async () => {
    expect(await refusal([ACME, { ...GLOBEX, id: 'globex corp' }])).toMatch(/tenants\[1\] id "globex corp" is not 1-64 characters/u)
    expect(await refusal([{ ...ACME, slug: 'Acme' }])).toMatch(/tenants\[0\] slug "Acme" is not one lowercase DNS label/u)
    expect(await refusal([{ ...ACME, displayName: '  ' }])).toMatch(/tenants\[0\] displayName is blank/u)
    expect(await refusal([{ ...ACME, hosts: ['https://acme.example.com'] }])).toMatch(/is not a hostname/u)
  })

  it('refuses two rows claiming one id, slug, or hostname', async () => {
    expect(await refusal([ACME, { ...GLOBEX, id: 'acme' }])).toMatch(/claims id "acme", which tenant "acme" already claims/u)
    expect(await refusal([ACME, { ...GLOBEX, slug: 'acme' }])).toMatch(/claims slug "acme"/u)
    expect(await refusal([ACME, { ...GLOBEX, hosts: ['acme.com'] }])).toMatch(/claims host "acme.com"/u)
  })
})
