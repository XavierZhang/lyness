/**
 * REAL-composition coverage: a test-only cordis.yml booted through the vendored
 * Loader mounts the Connection, the request scope, the durable configuration
 * store, and this namespace. A save made inside a real request is asserted
 * where it lands — the store, read back by a later request.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import * as Connection from '@lyness/lyn-client-connection'
import type { CredentialProvider, CredentialRecord } from '@lyness/lyn-credentials'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import StoredTenantConfigStore from '@lyness/lyn-tenant-config-store'
import RequestTenantScope from '@lyness/lyn-tenant-request'
import { TenantId } from '@lyness/lyn-tenant'
import { remoteErrorOf } from '@lyness/lyn-typert-protocol'
import TenantController from '../src/index.ts'
import type { TenantConfigInput, TenantConfigView } from '../src/index.ts'

const CREDENTIALS = 'test:credentials'
const CONNECTION = '@lyness/lyn-client-connection'
const STORAGE = '@lyness/lyn-storage'
const JSON_MEDIUM = '@lyness/lyn-storage-json'
const DOMAINS = '@lyness/lyn-storage-domain'
const DIRECTORY = '@lyness/lyn-tenant-static'
const STORE = '@lyness/lyn-tenant-config-store'
const SCOPE = '@lyness/lyn-tenant-request'
const CONTROLLER = '@lyness/lyn-api-tenant-controller'

/** In-memory stand-in for the credential store Connection keeps its cookie secret in. */
class MemoryCredentials {
  private record: CredentialRecord | undefined

  readRecord(): Promise<CredentialRecord | undefined> {
    return Promise.resolve(this.record)
  }

  async modifyRecord(
    _key: unknown,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    const next = await mutate(this.record)
    if (next !== undefined) this.record = next
    return this.record
  }

  deleteRecord(): Promise<void> {
    this.record = undefined
    return Promise.resolve()
  }
}

const credentialsPlugin = {
  name: 'test-credentials',
  apply: (ctx: Context) => {
    ctx.provide('credentials', new MemoryCredentials() as unknown as CredentialProvider)
  },
}

const FLASH = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }

const INPUT: TenantConfigInput = {
  models: {
    language: { available: [FLASH], preferred: FLASH },
    image: { available: [] },
    video: { available: [] },
    music: { available: [] },
  },
  providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
  features: ['workflow'],
  identity: { constraints: ['No unreleased figures.'] },
}

let root: string | undefined
let context: Context | undefined
/** Set by the interceptor to whatever the namespace answered or threw. */
let answer: unknown

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
  answer = undefined
})

/** Boot the rows through the real Loader over one medium directory. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'lyn-tenant-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${CREDENTIALS}'`,
    `- name: '${CONNECTION}'`,
    `- name: '${STORAGE}'`,
    `- name: '${JSON_MEDIUM}'`,
    '  config:',
    `    root: '${join(root, 'records')}'`,
    `- name: '${DOMAINS}'`,
    '  config:',
    "    backend: 'json'",
    `- name: '${STORE}'`,
    `- name: '${DIRECTORY}'`,
    '  config:',
    '    tenants:',
    "      - id: 'acme'",
    "        slug: 'acme'",
    "        displayName: 'Acme'",
    `- name: '${SCOPE}'`,
    `- name: '${CONTROLLER}'`,
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = `${pathToFileURL(root).href}/`
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [CREDENTIALS, credentialsPlugin],
    [CONNECTION, Connection],
    [STORAGE, Storage],
    [JSON_MEDIUM, StorageJson],
    [DOMAINS, StorageDomain],
    [STORE, StoredTenantConfigStore],
    [DIRECTORY, StaticTenantDirectory],
    [SCOPE, RequestTenantScope],
    [CONTROLLER, TenantController],
  ])
  context.loader.internal = {
    version: 'v2',
    import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(modules.get(specifier))
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await context.loader.await()
  return context
}

/**
 * Serve one namespace method inside a real request on the `/api` dispatch path.
 * @param ctx - the booted context.
 * @param headers - headers naming (or failing to name) a tenant.
 * @param method - what to run inside the request.
 * @returns what the method answered, or the error it threw.
 */
async function overRequest(
  ctx: Context,
  headers: Record<string, string>,
  method: (controller: TenantController) => unknown,
): Promise<unknown> {
  const dispose = ctx.connection.rpc.intercept('/api', () => true, async () => {
    try {
      answer = await method(ctx.tenantController)
    } catch (error: unknown) {
      answer = error
    }
    return { ok: true, value: null }
  })
  const shared = ctx.connection.createSharedFetchHandler('/api')
  await shared.fetch(new Request('http://host/api/tenant/describe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'tenant/describe', payload: {} }),
  }))
  await dispose()
  return answer
}

describe('the composed tenant namespace', () => {
  it('saves the calling tenant a configuration the store keeps and a later request reads back', async () => {
    const ctx = await compose()
    const header = { 'x-tenant-id': 'acme' }

    const before = await overRequest(ctx, header, controller => controller.describe()) as TenantConfigView
    expect(before).toMatchObject({ tenantId: 'acme', writable: true, configured: false, features: [] })

    const saved = await overRequest(ctx, header, controller => controller.save(INPUT)) as TenantConfigView
    expect(saved).toMatchObject({
      configured: true,
      features: ['workflow'],
      identity: { constraints: ['No unreleased figures.'] },
    })

    const after = await overRequest(ctx, header, controller => controller.describe()) as TenantConfigView
    expect(after).toMatchObject({ configured: true, features: ['workflow'] })
    expect(await ctx.tenantConfig.get(TenantId('acme'))).toMatchObject({
      providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
    })
  })

  it('refuses a request that names no tenant, and stores nothing for anyone', async () => {
    const ctx = await compose()
    const refused = await overRequest(ctx, {}, controller => controller.save(INPUT))
    expect(remoteErrorOf(refused)?.code).toBe('tenant/unresolved')
    expect(await ctx.tenantConfig.get(TenantId('acme'))).toBeUndefined()
  })
})
