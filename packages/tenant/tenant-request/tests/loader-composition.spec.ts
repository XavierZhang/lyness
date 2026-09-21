/**
 * REAL-composition coverage: a test-only cordis.yml booted through the vendored
 * Loader mounts the Connection, the tenant directory, the tenant configuration,
 * and this plugin. The assertion is what a call sees — one POST over the real
 * `/api` dispatch path, answered from `ctx.requestTenant.current()`.
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
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import StaticTenantConfigStore from '@lyness/lyn-tenant-config-static'
import RequestTenantScope from '../src/index.ts'
import type { RequestTenant } from '../src/index.ts'

const CREDENTIALS = 'test:credentials'
const CONNECTION = '@lyness/lyn-client-connection'
const DIRECTORY = '@lyness/lyn-tenant-static'
const CONFIG = '@lyness/lyn-tenant-config-static'
const SCOPE = '@lyness/lyn-tenant-request'

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

let root: string | undefined
let context: Context | undefined
let seen: RequestTenant | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
  seen = undefined
})

/**
 * Boot the rows through the real Loader.
 * @param configured - whether a tenant-configuration store is part of the composition.
 * @returns the booted context.
 */
async function compose(configured: boolean): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'lyn-tenant-request-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${CREDENTIALS}'`,
    `- name: '${CONNECTION}'`,
    `- name: '${DIRECTORY}'`,
    '  config:',
    '    tenants:',
    "      - id: 'acme'",
    "        slug: 'acme'",
    "        displayName: 'Acme'",
    '        hosts:',
    "          - 'acme.internal'",
    ...configured
      ? [
        `- name: '${CONFIG}'`,
        '  config:',
        '    tenants:',
        "      - tenantId: 'acme'",
        '        features:',
        "          - 'workflow'",
      ]
      : [],
    `- name: '${SCOPE}'`,
    '  config:',
    "    baseDomain: 'example.com'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = `${pathToFileURL(root).href}/`
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [CREDENTIALS, credentialsPlugin],
    [CONNECTION, Connection],
    [DIRECTORY, StaticTenantDirectory],
    [CONFIG, StaticTenantConfigStore],
    [SCOPE, RequestTenantScope],
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
  // One namespace owner for the whole composition: the shared channel holds one.
  context.connection.rpc.intercept('/api', () => true, () => {
    seen = context?.requestTenant.current()
    return Promise.resolve({ ok: true, value: null })
  })
  return context
}

/**
 * Make one decoded call and answer with the tenant the scope published.
 * @param ctx - the booted context.
 * @param headers - headers naming (or failing to name) a tenant.
 * @returns what `current()` returned inside the call.
 */
async function callSeeing(ctx: Context, headers: Record<string, string>): Promise<RequestTenant | undefined> {
  seen = undefined
  const shared = ctx.connection.createSharedFetchHandler('/api')
  const response = await shared.fetch(new Request('http://host/api/probe/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'probe/read', payload: {} }),
  }))
  expect(response.status).toBe(200)
  return seen
}

describe('the composed request tenant', () => {
  it('publishes the tenant a header names, with the configuration it was granted', async () => {
    const ctx = await compose(true)
    expect(await callSeeing(ctx, { 'x-tenant-id': 'acme', host: 'app.example.com' })).toMatchObject({
      tenant: { id: 'acme', slug: 'acme', displayName: 'Acme' },
      source: 'header',
      config: { tenantId: 'acme', features: ['workflow'] },
    })
  })

  it('resolves a hostname and a subdomain the same way the HTTP route does', async () => {
    const ctx = await compose(true)
    expect(await callSeeing(ctx, { host: 'acme.internal:8080' })).toMatchObject({ source: 'host' })
    expect(await callSeeing(ctx, { host: 'acme.example.com' })).toMatchObject({ source: 'subdomain' })
  })

  it('publishes a tenant with no configuration when no store is mounted', async () => {
    const ctx = await compose(false)
    const seen = await callSeeing(ctx, { 'x-tenant-id': 'acme', host: 'app.example.com' })
    expect(seen?.tenant.id).toBe('acme')
    expect(seen?.config).toBeUndefined()
  })

  it('leaves a call that names no tenant without one, rather than refusing it', async () => {
    const ctx = await compose(true)
    expect(await callSeeing(ctx, { host: 'app.example.com' })).toBeUndefined()
    expect(await callSeeing(ctx, { 'x-tenant-id': 'globex', host: 'app.example.com' })).toBeUndefined()
  })

  it('answers undefined outside a call', async () => {
    const ctx = await compose(true)
    expect(ctx.requestTenant.current()).toBeUndefined()
  })
})
