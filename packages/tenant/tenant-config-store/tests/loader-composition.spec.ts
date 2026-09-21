/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the storage medium, the domain registry, and this
 * store, and the assertion is the durable outcome — what a second boot over
 * the same directory reads back.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { TenantId } from '@lyness/lyn-tenant'
import { credentialRef } from '@lyness/lyn-credentials'
import type { TenantConfig } from '@lyness/lyn-tenant-config'
import StoredTenantConfigStore from '../src/index.ts'

const STORAGE = '@lyness/lyn-storage'
const JSON_MEDIUM = '@lyness/lyn-storage-json'
const DOMAINS = '@lyness/lyn-storage-domain'
const STORE = '@lyness/lyn-tenant-config-store'

let root: string | undefined
const contexts: Context[] = []

afterEach(async () => {
  for (const context of contexts.splice(0)) await context.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/**
 * Boot the four rows through the real Loader over one medium directory.
 * @param home - directory the composition config and the records live in.
 * @returns the booted context.
 */
async function compose(home: string): Promise<Context> {
  const configPath = join(home, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${STORAGE}'`,
    `- name: '${JSON_MEDIUM}'`,
    '  config:',
    `    root: '${join(home, 'records')}'`,
    `- name: '${DOMAINS}'`,
    '  config:',
    "    backend: 'json'",
    `- name: '${STORE}'`,
    '',
  ].join('\n'))

  const context = new Context()
  contexts.push(context)
  context.baseUrl = `${pathToFileURL(home).href}/`
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [STORAGE, Storage],
    [JSON_MEDIUM, StorageJson],
    [DOMAINS, StorageDomain],
    [STORE, StoredTenantConfigStore],
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

const CONFIG: TenantConfig = {
  tenantId: TenantId('acme'),
  models: {
    language: {
      available: [{ provider: 'deepseek-official', model: 'deepseek-v4-flash' }],
      preferred: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    },
    image: { available: [] },
    video: { available: [] },
    music: { available: [] },
  },
  providers: [{ provider: 'deepseek-official', credential: credentialRef('ACME_DEEPSEEK_API_KEY') }],
  features: ['workflow'],
}

describe('the composed durable store', () => {
  it('serves the seam and keeps a save for the next deployment of the same rows', async () => {
    root = await mkdtemp(join(tmpdir(), 'lyn-tenant-config-store-'))
    const first = await compose(root)
    const capability = first.tenantConfig.capability()
    if (capability.kind !== 'writable') throw new Error('expected a writable capability')
    await capability.save(CONFIG)
    await first.fiber.dispose()
    contexts.length = 0

    const second = await compose(root)
    expect(await second.tenantConfig.get(TenantId('acme'))).toMatchObject({
      tenantId: 'acme',
      features: ['workflow'],
      providers: [{ provider: 'deepseek-official', credential: 'ACME_DEEPSEEK_API_KEY' }],
    })
  })
})
