/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the web server, the configured roster, and this
 * route, and the assertions are the answers a gateway or a browser receives
 * over real HTTP — which tenant a request resolves to, how it was named, and
 * what an unresolved or wrongly-shaped request is told instead.
 */

import { request } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import HttpServer from '@lyness/lyn-host-webserver'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import * as TenantHttp from '../src/index.ts'

const WEBSERVER = '@lyness/lyn-host-webserver'
const STATIC = '@lyness/lyn-tenant-static'
const HTTP = '@lyness/lyn-tenant-http'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot the three rows through the real Loader and report the listening port. */
async function compose(): Promise<number> {
  root = await mkdtemp(join(tmpdir(), 'lyn-tenant-http-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${WEBSERVER}'`,
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    `- name: '${STATIC}'`,
    '  config:',
    '    tenants:',
    "      - id: 'acme'",
    "        slug: 'acme'",
    "        displayName: 'Acme'",
    '        hosts:',
    "          - 'acme.example.com'",
    `- name: '${HTTP}'`,
    '  config:',
    "    baseDomain: 'tenants.example.com'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = `${pathToFileURL(root).href}/`
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    [WEBSERVER, HttpServer],
    [STATIC, StaticTenantDirectory],
    [HTTP, TenantHttp],
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
  return context.get('webServer')!.port
}

/** One HTTP request to the composed server, with the headers a gateway or browser would send. */
function ask(
  port: number,
  headers: Record<string, string>,
  options: { path?: string; method?: string } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: options.path ?? '/tenant', method: options.method ?? 'GET', headers },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => { body += chunk })
        res.on('end', () => { resolve({ status: res.statusCode ?? 0, body }) })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

describe('the composed tenant route', () => {
  it('resolves a request by its header, its hostname, and its subdomain', async () => {
    const port = await compose()

    expect(await ask(port, { host: 'unknown.example.com', 'x-tenant-id': 'acme' }))
      .toEqual({ status: 200, body: JSON.stringify({ id: 'acme', slug: 'acme', displayName: 'Acme', source: 'header' }) })
    expect(JSON.parse((await ask(port, { host: 'acme.example.com' })).body)).toMatchObject({ id: 'acme', source: 'host' })
    expect(JSON.parse((await ask(port, { host: 'acme.tenants.example.com' })).body)).toMatchObject({ id: 'acme', source: 'subdomain' })
  })

  it('refuses a request that names no tenant of this deployment', async () => {
    const port = await compose()
    for (const headers of [{ host: 'globex.example.com' }, { host: 'acme.example.com', 'x-tenant-id': 'globex' }]) {
      expect(await ask(port, headers)).toEqual({ status: 404, body: JSON.stringify({ error: 'unknown-tenant' }) })
    }
  })

  it('answers only the route it claims, and only for a read', async () => {
    const port = await compose()
    expect(await ask(port, { host: 'acme.example.com' }, { method: 'POST' }))
      .toEqual({ status: 405, body: JSON.stringify({ error: 'method-not-allowed' }) })
    expect(await ask(port, { host: 'acme.example.com' }, { path: '/tenant/roster' }))
      .toEqual({ status: 404, body: '' })
  })
})
