/** Contract behavior the seam owns: registration identity, the two capabilities, and every configuration rule. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { credentialRef } from '@lyness/lyn-credentials'
import { TenantId } from '@lyness/lyn-tenant'
import { MODALITIES, TenantConfigStore, validateTenantConfig } from '../src/index.ts'
import type { Modality, ModalityModels, TenantConfig, TenantConfigCapability } from '../src/index.ts'

const FLASH = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }

/**
 * A configuration with one granted provider and one language model.
 * @param overrides - fields replacing the usable configuration's.
 * @returns the configuration.
 */
function config(overrides: Partial<TenantConfig> = {}): TenantConfig {
  const empty: ModalityModels = { available: [] }
  return {
    tenantId: TenantId('acme'),
    models: Object.fromEntries(MODALITIES.map(modality => [
      modality,
      modality === 'language' ? { available: [FLASH], preferred: FLASH } : empty,
    ])) as Record<Modality, ModalityModels>,
    providers: [{ provider: 'deepseek-official', credential: credentialRef('ACME_DEEPSEEK_API_KEY') }],
    features: ['workflow'],
    ...overrides,
  }
}

/** A read-only store answering one tenant. */
class StubStore extends TenantConfigStore {
  get(tenantId: TenantConfig['tenantId']): Promise<TenantConfig | undefined> {
    return Promise.resolve(tenantId === 'acme' ? config() : undefined)
  }

  capability(): TenantConfigCapability {
    return { kind: 'read-only' }
  }
}

describe('TenantConfigStore seam', () => {
  it('registers a subclass as ctx.tenantConfig and leaves with its fiber', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(StubStore)
    await fiber.await()
    const store = ctx.get('tenantConfig')
    expect(store).toBeInstanceOf(StubStore)
    expect(await store!.get(TenantId('acme'))).toMatchObject({ features: ['workflow'] })
    expect(await store!.get(TenantId('globex'))).toBeUndefined()
    await fiber.dispose()
    expect(ctx.get('tenantConfig')).toBeUndefined()
  })

  it('states whether it can be saved to, so a surface shows or hides saving', async () => {
    const saved: TenantConfig[] = []
    class WritableStore extends TenantConfigStore {
      get(): Promise<TenantConfig | undefined> {
        return Promise.resolve(config())
      }

      capability(): TenantConfigCapability {
        return { kind: 'writable', save: (next: TenantConfig) => { saved.push(next); return Promise.resolve() } }
      }
    }
    const ctx = new Context()
    await ctx.plugin(WritableStore).await()
    const capability = ctx.get('tenantConfig')!.capability()
    expect(capability.kind).toBe('writable')
    if (capability.kind !== 'writable') throw new Error('expected a writable capability')
    await capability.save(config())
    expect(saved).toHaveLength(1)
  })
})

describe('validateTenantConfig', () => {
  it('accepts a configuration whose models, providers, and features all line up', () => {
    expect(validateTenantConfig(config())).toEqual([])
    expect(validateTenantConfig(config({ identity: { constraints: ['no unreleased figures'], personality: 'terse' }, copy: { 'session.new.label': 'New ticket' } })))
      .toEqual([])
  })

  it('refuses a model whose provider the tenant has no grant for', () => {
    const models = { ...config().models, image: { available: [{ provider: 'recraft', model: 'recraft-v3' }] } }
    expect(validateTenantConfig(config({ models }))).toEqual([
      'image model recraft/recraft-v3 names a provider this tenant has no grant for',
    ])
  })

  it('refuses a preferred model that is not available, and a model listed twice', () => {
    const models = {
      ...config().models,
      language: { available: [FLASH, FLASH], preferred: { provider: 'deepseek-official', model: 'deepseek-v4-pro' } },
    }
    expect(validateTenantConfig(config({ models }))).toEqual([
      'language model deepseek-official/deepseek-v4-flash is listed twice',
      'language prefers deepseek-official/deepseek-v4-pro, which is not among its available models',
    ])
  })

  it('refuses a blank model id, and names an effort-qualified model whole', () => {
    const models = {
      ...config().models,
      language: { available: [{ provider: 'deepseek-official', model: ' ', reasoningEffort: 'high' }] },
    }
    expect(validateTenantConfig(config({ models }))).toEqual([
      'language model deepseek-official/ @high has a blank model id',
    ])
  })

  it('refuses a duplicated or blank provider grant', () => {
    const credential = credentialRef('ACME_DEEPSEEK_API_KEY')
    expect(validateTenantConfig(config({
      providers: [{ provider: 'deepseek-official', credential }, { provider: 'deepseek-official', credential }, { provider: ' ', credential }],
    }))).toEqual([
      'provider "deepseek-official" is granted twice',
      'a provider grant has a blank provider id',
    ])
  })

  it('refuses a duplicated or blank feature, constraint, and copy override', () => {
    expect(validateTenantConfig(config({
      features: ['workflow', 'workflow', ' '],
      identity: { constraints: ['ok', '  '] },
      copy: { 'session.new.label': ' ' },
    }))).toEqual([
      'feature "workflow" is listed twice',
      'a feature id is blank',
      'identity constraint 1 is blank',
      'copy override "session.new.label" is blank',
    ])
  })
})
