/** What the tenant namespace answers, and what it refuses. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { remoteErrorOf } from '@lyness/lyn-typert-protocol'
import { TenantId } from '@lyness/lyn-tenant'
import { TenantConfigStore } from '@lyness/lyn-tenant-config'
import type { TenantConfig, TenantConfigCapability } from '@lyness/lyn-tenant-config'
import type { RequestTenant, RequestTenantReader } from '@lyness/lyn-tenant-request/types'
import TenantController from '../src/index.ts'
import type { TenantConfigInput } from '../src/index.ts'

const ACME = { id: TenantId('acme'), slug: 'acme', displayName: 'Acme' }

const FLASH = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }

/** A configuration the seam accepts: one grant, one language model, nothing else. */
function input(overrides: Partial<TenantConfigInput> = {}): TenantConfigInput {
  return {
    models: {
      language: { available: [FLASH], preferred: FLASH },
      image: { available: [] },
      video: { available: [] },
      music: { available: [] },
    },
    providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
    features: ['workflow'],
    ...overrides,
  }
}

/** An in-memory backend whose writability the test chooses. */
class TestStore extends TenantConfigStore {
  static saved: TenantConfig | undefined
  static writable = true

  get(): Promise<TenantConfig | undefined> {
    return Promise.resolve(TestStore.saved)
  }

  capability(): TenantConfigCapability {
    if (!TestStore.writable) return { kind: 'read-only' }
    return {
      kind: 'writable',
      save: (config) => {
        TestStore.saved = config
        return Promise.resolve()
      },
    }
  }
}

/** A backend that accepts the capability check and then refuses the write. */
class RefusingStore extends TestStore {
  override capability(): TenantConfigCapability {
    return { kind: 'writable', save: () => Promise.reject(new Error('the roster is locked')) }
  }
}

/** A backend that refuses with a bare string, the way some storage clients do. */
class LiteralRefusingStore extends TestStore {
  override capability(): TenantConfigCapability {
    return { kind: 'writable', save: async (): Promise<void> => { throw 'the document is locked' } }
  }
}

interface Harness {
  readonly controller: TenantController
  readonly dispose: () => Promise<void>
}

/**
 * Mount the controller over a chosen backend and a chosen calling tenant.
 * @param options - which backend is mounted, and what the request resolved to.
 * @returns the controller and its disposer.
 */
async function harness(options: {
  store?: typeof TestStore | null
  /** null makes every read answer "this call named no tenant". */
  calling?: RequestTenant | null
  writable?: boolean
} = {}): Promise<Harness> {
  TestStore.saved = undefined
  TestStore.writable = options.writable ?? true
  const ctx = new Context()
  const reader: RequestTenantReader = {
    current: () => options.calling === null ? undefined : options.calling ?? { tenant: ACME, source: 'header' },
  }
  await ctx.plugin({
    name: 'test-request-tenant',
    apply: (pluginCtx: Context) => { pluginCtx.provide('requestTenant', reader) },
  })
  if (options.store !== null) await ctx.plugin(options.store ?? TestStore)
  await ctx.plugin(TenantController)
  return { controller: ctx.tenantController, dispose: () => ctx.fiber.dispose() }
}

describe('the tenant namespace', () => {
  it('describes an unconfigured tenant as itself with nothing granted', async () => {
    const { controller, dispose } = await harness()
    expect(controller.describe()).toEqual({
      tenantId: 'acme',
      slug: 'acme',
      displayName: 'Acme',
      writable: true,
      configured: false,
      models: {
        language: { available: [] },
        image: { available: [] },
        video: { available: [] },
        music: { available: [] },
      },
      providers: [],
      features: [],
      copy: {},
    })
    await dispose()
  })

  it('reports a read-only deployment as one a surface must not offer saving on', async () => {
    const { controller, dispose } = await harness({ writable: false })
    expect(controller.describe().writable).toBe(false)
    await dispose()
  })

  it('saves what the call sent and answers with what the store kept', async () => {
    const { controller, dispose } = await harness()
    const saved = await controller.save(input({
      identity: { constraints: ['No unreleased figures.'], personality: 'Answer briefly.' },
      copy: { 'session.new.label': 'New ticket' },
    }))
    expect(saved).toMatchObject({
      tenantId: 'acme',
      configured: true,
      models: { language: { available: [FLASH], preferred: FLASH } },
      providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
      features: ['workflow'],
      identity: { constraints: ['No unreleased figures.'], personality: 'Answer briefly.' },
      copy: { 'session.new.label': 'New ticket' },
    })
    expect(TestStore.saved?.tenantId).toBe('acme')
    await dispose()
  })

  it('keeps a self-hosted endpoint and a reasoning effort, and drops an identity that says nothing', async () => {
    const { controller, dispose } = await harness()
    const reasoning = { provider: 'self-hosted', model: 'qwen3-32b', reasoningEffort: 'high' }
    const saved = await controller.save(input({
      models: {
        language: { available: [reasoning], preferred: reasoning },
        image: { available: [] },
        video: { available: [] },
        music: { available: [] },
      },
      providers: [{ provider: 'self-hosted', credential: 'ACME_KEY', baseUrl: 'https://models.acme.internal/v1' }],
      features: [],
      identity: { constraints: [] },
      copy: {},
    }))
    expect(saved.models.language).toEqual({ available: [reasoning], preferred: reasoning })
    expect(saved.providers[0]?.baseUrl).toBe('https://models.acme.internal/v1')
    expect(saved.identity).toBeUndefined()
    expect(saved.copy).toEqual({})
    await dispose()
  })

  it('refuses a call that names no tenant, on both methods', async () => {
    const { controller, dispose } = await harness({ calling: null })
    expect(() => controller.describe()).toThrow(/names no tenant/u)
    const error = remoteErrorOf(await controller.save(input()).catch((caught: unknown) => caught))
    expect(error?.code).toBe('tenant/unresolved')
    expect(TestStore.saved).toBeUndefined()
    await dispose()
  })

  it('refuses malformed wire fields before it reaches the store', async () => {
    const { controller, dispose } = await harness()
    const bad = input({ providers: [{ provider: 'deepseek-official', credential: 'not a reference' }] })
    const error = remoteErrorOf(await controller.save(bad).catch((caught: unknown) => caught))
    expect(error?.code).toBe('gateway/bad-request')
    expect(error?.message).toMatch(/not a credential reference/u)
    expect(TestStore.saved).toBeUndefined()

    const { music: _dropped, ...partial } = input().models
    const missing = remoteErrorOf(await controller
      .save(input({ models: partial }))
      .catch((caught: unknown) => caught))
    expect(missing?.code).toBe('gateway/bad-request')
    expect(missing?.message).toMatch(/music/u)
    expect(TestStore.saved).toBeUndefined()
    await dispose()
  })

  it('refuses a configuration the seam rules reject, listing every problem', async () => {
    const { controller, dispose } = await harness()
    const bad = input({
      models: {
        language: { available: [FLASH], preferred: FLASH },
        image: { available: [{ provider: 'recraft', model: 'recraft-v3' }] },
        video: { available: [] },
        music: { available: [] },
      },
      features: ['workflow', 'workflow'],
    })
    const error = remoteErrorOf(await controller.save(bad).catch((caught: unknown) => caught))
    expect(error?.code).toBe('tenant/rejected')
    expect(error?.details).toMatchObject({ tenantId: 'acme' })
    expect((error?.details as { problems: string[] }).problems).toHaveLength(2)
    expect(TestStore.saved).toBeUndefined()
    await dispose()
  })

  it('refuses a save when this deployment mounts no store', async () => {
    const { controller, dispose } = await harness({ store: null })
    const error = remoteErrorOf(await controller.save(input()).catch((caught: unknown) => caught))
    expect(error?.code).toBe('gateway/internal')
    expect(controller.describe().writable).toBe(false)
    await dispose()
  })

  it('refuses a save when the mounted store does not accept them', async () => {
    const { controller, dispose } = await harness({ writable: false })
    const error = remoteErrorOf(await controller.save(input()).catch((caught: unknown) => caught))
    expect(error?.code).toBe('tenant/read-only')
    expect(error?.details).toEqual({ tenantId: 'acme' })
    await dispose()
  })

  it('reports a backend that accepted the request and then refused the write', async () => {
    const { controller, dispose } = await harness({ store: RefusingStore })
    const error = remoteErrorOf(await controller.save(input()).catch((caught: unknown) => caught))
    expect(error?.code).toBe('tenant/rejected')
    expect(error?.details).toEqual({ tenantId: 'acme', problems: ['the roster is locked'] })
    await dispose()
  })

  it('carries a refusal that was not an Error through as its own text', async () => {
    const { controller, dispose } = await harness({ store: LiteralRefusingStore })
    const error = remoteErrorOf(await controller.save(input()).catch((caught: unknown) => caught))
    expect(error?.code).toBe('tenant/rejected')
    expect(error?.details).toEqual({ tenantId: 'acme', problems: ['the document is locked'] })
    await dispose()
  })
})
