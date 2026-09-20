/** What an operator's rows produce: one tenant's configuration, and every refusal a bad row causes. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { TenantId } from '@lyness/lyn-tenant'
import StaticTenantConfigStore from '../src/index.ts'
import type { Config, TenantConfigEntry } from '../src/index.ts'

const ACME: TenantConfigEntry = {
  tenantId: 'acme',
  providers: [
    { provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' },
    { provider: 'self-hosted', credential: 'ACME_SELF_HOSTED_KEY', baseUrl: 'https://models.acme.internal/v1' },
  ],
  models: {
    language: {
      available: [
        { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
        { provider: 'self-hosted', model: 'qwen3-32b', reasoningEffort: 'high' },
      ],
      preferred: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    },
    image: { available: [{ provider: 'self-hosted', model: 'sdxl' }] },
  },
  features: ['workflow'],
  identity: { constraints: ['no unreleased figures'], personality: 'terse' },
  copy: { 'session.new.label': 'New ticket' },
}

/**
 * Mount the store over a roster.
 * @param tenants - the configured rows.
 * @returns the mounted store.
 */
async function store(tenants: TenantConfigEntry[]): Promise<StaticTenantConfigStore> {
  const ctx = new Context()
  await ctx.plugin(StaticTenantConfigStore, { tenants } satisfies Config).await()
  return ctx.get('tenantConfig') as StaticTenantConfigStore
}

/**
 * Run a roster expected to be refused, and report the refusal message.
 * @param tenants - the configured rows.
 * @returns the message, or undefined when the roster was accepted.
 */
async function refusal(tenants: TenantConfigEntry[]): Promise<string | undefined> {
  try {
    await store(tenants)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return undefined
}

describe('static tenant configuration', () => {
  it('reads one row as a complete configuration, with every modality present', async () => {
    const configured = await store([ACME])
    const acme = await configured.get(TenantId('acme'))

    expect(acme?.models.language).toEqual({
      available: [
        { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
        { provider: 'self-hosted', model: 'qwen3-32b', reasoningEffort: 'high' },
      ],
      preferred: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    })
    expect(acme?.models.image.available).toHaveLength(1)
    expect(acme?.models.video).toEqual({ available: [] })
    expect(acme?.models.music).toEqual({ available: [] })
    expect(acme?.providers[1]).toEqual({
      provider: 'self-hosted',
      credential: 'ACME_SELF_HOSTED_KEY',
      baseUrl: 'https://models.acme.internal/v1',
    })
    expect(acme?.features).toEqual(['workflow'])
    expect(acme?.identity).toEqual({ constraints: ['no unreleased figures'], personality: 'terse' })
    expect(acme?.copy).toEqual({ 'session.new.label': 'New ticket' })
  })

  it('reads a row that configures nothing but its tenant', async () => {
    const configured = await store([{ tenantId: 'globex' }])
    const globex = await configured.get(TenantId('globex'))
    expect(globex).toEqual({
      tenantId: 'globex',
      models: { language: { available: [] }, image: { available: [] }, video: { available: [] }, music: { available: [] } },
      providers: [],
      features: [],
    })
  })

  it('keeps an identity that states rules without stating a voice', async () => {
    const configured = await store([{ tenantId: 'globex', identity: { constraints: ['no personal data'] } }])
    const globex = await configured.get(TenantId('globex'))
    expect(globex?.identity).toEqual({ constraints: ['no personal data'] })
    expect(globex?.copy).toBeUndefined()
  })

  it('answers undefined for a tenant no row configures, and reads as read-only', async () => {
    const configured = await store([ACME])
    expect(await configured.get(TenantId('globex'))).toBeUndefined()
    expect(configured.capability()).toEqual({ kind: 'read-only' })
  })

  it('leaves with its fiber', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(StaticTenantConfigStore, { tenants: [ACME] } satisfies Config)
    await fiber.await()
    expect(ctx.get('tenantConfig')).toBeInstanceOf(StaticTenantConfigStore)
    await fiber.dispose()
    expect(ctx.get('tenantConfig')).toBeUndefined()
  })

  it('refuses an empty roster, a malformed tenant id, and a tenant configured twice', async () => {
    expect(await refusal([])).toMatch(/configures no tenant/u)
    expect(await refusal([{ tenantId: 'acme corp' }])).toMatch(/tenants\[0\] tenantId "acme corp" is not 1-64 characters/u)
    expect(await refusal([ACME, { tenantId: 'acme' }])).toMatch(/tenants\[1\] configures tenant "acme" a second time/u)
  })

  it('refuses a credential that is not a reference', async () => {
    const entry = { tenantId: 'globex', providers: [{ provider: 'deepseek-official', credential: 'sk-live-1234' }] }
    expect(await refusal([entry])).toMatch(/names "sk-live-1234", which is not a credential reference/u)
  })

  it('refuses a row whose models and grants do not line up, listing every problem', async () => {
    const entry: TenantConfigEntry = {
      tenantId: 'globex',
      providers: [{ provider: 'deepseek-official', credential: 'GLOBEX_KEY' }],
      models: { image: { available: [{ provider: 'recraft', model: 'recraft-v3' }] } },
      features: ['workflow', 'workflow'],
    }
    const message = await refusal([entry])
    expect(message).toMatch(/tenants\[0\] is unusable:/u)
    expect(message).toMatch(/image model recraft\/recraft-v3 names a provider this tenant has no grant for/u)
    expect(message).toMatch(/feature "workflow" is listed twice/u)
  })
})
