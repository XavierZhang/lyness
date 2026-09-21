/**
 * REAL-composition coverage for the request-scoped half: a session created
 * inside an RPC call is stamped with the tenant of that call, and a session
 * created outside one keeps the deployment's configured tenant.
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
import SessionStore from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import StaticTenantConfigStore from '@lyness/lyn-tenant-config-static'
import RequestTenantScope from '@lyness/lyn-tenant-request'
import * as TenantSession from '../src/index.ts'
import type { TenantSessionRecord } from '../src/index.ts'

const CREDENTIALS = 'test:credentials'
const CONNECTION = '@lyness/lyn-client-connection'
const SESSIONS = '@lyness/lyn-session'
const PROJECTIONS = '@lyness/lyn-session-projection'
const DIRECTORY = '@lyness/lyn-tenant-static'
const CONFIG = '@lyness/lyn-tenant-config-static'
const SCOPE = '@lyness/lyn-tenant-request'
const STAMP = '@lyness/lyn-tenant-session'

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

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot a two-tenant deployment whose configured fallback is `acme`. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'lyn-tenant-session-request-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${CREDENTIALS}'`,
    `- name: '${CONNECTION}'`,
    `- name: '${SESSIONS}'`,
    `- name: '${PROJECTIONS}'`,
    `- name: '${DIRECTORY}'`,
    '  config:',
    '    tenants:',
    "      - id: 'acme'",
    "        slug: 'acme'",
    "        displayName: 'Acme'",
    "      - id: 'globex'",
    "        slug: 'globex'",
    "        displayName: 'Globex'",
    `- name: '${CONFIG}'`,
    '  config:',
    '    tenants:',
    "      - tenantId: 'acme'",
    '        identity:',
    '          constraints:',
    "            - 'Acme rule.'",
    "      - tenantId: 'globex'",
    '        identity:',
    '          constraints:',
    "            - 'Globex rule.'",
    "          personality: 'Answer briefly.'",
    `- name: '${SCOPE}'`,
    `- name: '${STAMP}'`,
    '  config:',
    "    tenantId: 'acme'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = `${pathToFileURL(root).href}/`
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [CREDENTIALS, credentialsPlugin],
    [CONNECTION, Connection],
    [SESSIONS, SessionStore],
    [PROJECTIONS, SessionProjectionRegistry],
    [DIRECTORY, StaticTenantDirectory],
    [CONFIG, StaticTenantConfigStore],
    [SCOPE, RequestTenantScope],
    [STAMP, TenantSession],
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
 * Create one session the way a browser does: inside an RPC call.
 * @param ctx - the booted context.
 * @param tenantId - value of the tenant header the call carries.
 * @returns the tenant record the created session was stamped with.
 */
async function createOverRpc(ctx: Context, tenantId: string): Promise<TenantSessionRecord | null | undefined> {
  let stamped: TenantSessionRecord | null | undefined
  const dispose = ctx.connection.rpc.intercept('/api', () => true, () => {
    const session = ctx.sessions.create()
    stamped = ctx.sessionProjections.stateOf(session, 'tenant')
    return Promise.resolve({ ok: true, value: null })
  })
  const shared = ctx.connection.createSharedFetchHandler('/api')
  await shared.fetch(new Request('http://host/api/session/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r-1', method: 'session/create', payload: {} }),
  }))
  await dispose()
  return stamped
}

describe('the tenant a created session is stamped with', () => {
  it('is the tenant of the call that created it, not the configured one', async () => {
    const ctx = await compose()
    expect(await createOverRpc(ctx, 'globex')).toEqual({
      version: 1,
      tenantId: 'globex',
      slug: 'globex',
      constraints: ['Globex rule.'],
      personality: 'Answer briefly.',
    })
  })

  it('is the configured tenant for a session created outside any call', async () => {
    const ctx = await compose()
    const session = ctx.sessions.create()
    expect(ctx.sessionProjections.stateOf(session, 'tenant')).toEqual({
      version: 1,
      tenantId: 'acme',
      slug: 'acme',
      constraints: ['Acme rule.'],
    })
  })

  it('is the configured tenant when the call names none', async () => {
    const ctx = await compose()
    expect(await createOverRpc(ctx, 'unknown-tenant')).toMatchObject({ tenantId: 'acme' })
  })
})
