/** What a deployment keeps: a saved configuration read back, a refused one, and both across a restart. */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { credentialRef } from '@lyness/lyn-credentials'
import Storage from '@lyness/lyn-storage'
import {
  apply as jsonApply, Config as jsonConfig, inject as jsonInject, name as jsonName,
} from '@lyness/lyn-storage-json'
import {
  apply as domainApply, Config as domainConfig, inject as domainInject, name as domainName,
} from '@lyness/lyn-storage-domain'
import { TenantId } from '@lyness/lyn-tenant'
import { MODALITIES } from '@lyness/lyn-tenant-config'
import type { Modality, ModalityModels, TenantConfig } from '@lyness/lyn-tenant-config'
import StoredTenantConfigStore from '../src/index.ts'

const FLASH = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }

const roots: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await Promise.all(roots.splice(0).map(async (root) => { await rm(root, { recursive: true, force: true }) }))
})

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

/**
 * Mount the durable store over a JSON medium.
 * @param root - medium directory; a fresh one when omitted.
 * @returns the mounted store and the directory it writes into.
 */
async function harness(root?: string): Promise<{ store: StoredTenantConfigStore; root: string }> {
  const medium = root ?? await mkdtemp(join(tmpdir(), 'lyn-tenant-config-'))
  if (root === undefined) roots.push(medium)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin({ name: jsonName, inject: jsonInject, apply: jsonApply, Config: jsonConfig }, { root: medium })
  await ctx.plugin({ name: domainName, inject: domainInject, apply: domainApply, Config: domainConfig }, { backend: 'json' })
  await ctx.plugin(StoredTenantConfigStore).await()
  return { store: ctx.get('tenantConfig') as StoredTenantConfigStore, root: medium }
}

/**
 * Save through the capability, which is how an administration surface writes.
 * @param store - the mounted store.
 * @param next - the configuration to save.
 */
async function save(store: StoredTenantConfigStore, next: TenantConfig): Promise<void> {
  const capability = store.capability()
  if (capability.kind !== 'writable') throw new Error('expected a writable capability')
  await capability.save(next)
}

describe('durable tenant configuration', () => {
  it('reports that it accepts saves', async () => {
    const { store } = await harness()
    expect(store.capability().kind).toBe('writable')
  })

  it('reads back what was saved, and answers undefined for a tenant with no record', async () => {
    const { store } = await harness()
    expect(await store.get(TenantId('acme'))).toBeUndefined()

    await save(store, config({ features: ['workflow', 'subagent'] }))
    expect(await store.get(TenantId('acme'))).toMatchObject({
      tenantId: 'acme',
      features: ['workflow', 'subagent'],
      providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
    })
    expect(await store.get(TenantId('globex'))).toBeUndefined()
  })

  it('keeps what it saved across a restart', async () => {
    const first = await harness()
    await save(first.store, config({ identity: { constraints: ['no unreleased figures'] } }))

    const second = await harness(first.root)
    expect(await second.store.get(TenantId('acme'))).toMatchObject({
      identity: { constraints: ['no unreleased figures'] },
    })
  })

  it('refuses an unusable configuration and stores nothing', async () => {
    const { store } = await harness()
    const models = { ...config().models, image: { available: [{ provider: 'recraft', model: 'recraft-v3' }] } }
    await expect(save(store, config({ models })))
      .rejects.toThrow(/refusing to save an unusable configuration: image model recraft\/recraft-v3 names a provider/u)
    expect(await store.get(TenantId('acme'))).toBeUndefined()
  })

  it('saves each tenant as its own record, so one save leaves the others alone', async () => {
    const { store } = await harness()
    await save(store, config())
    await save(store, config({ tenantId: TenantId('globex'), features: [] }))
    await save(store, config({ features: ['subagent'] }))

    expect(await store.get(TenantId('acme'))).toMatchObject({ features: ['subagent'] })
    expect(await store.get(TenantId('globex'))).toMatchObject({ features: [] })
  })
})
