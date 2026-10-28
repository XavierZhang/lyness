/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the session store, the projection registry, the
 * tenant directory, the tenant configuration, and this plugin, and the
 * assertion is the durable outcome — the record a created session carries in
 * its own log.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import StaticTenantDirectory from '@deepseek-ai/dsh-tenant-static'
import StaticTenantConfigStore from '@deepseek-ai/dsh-tenant-config-static'
import * as TenantSession from '../src/index.ts'
import type { TenantSessionRecord } from '../src/index.ts'

const AGENTS = '@deepseek-ai/dsh-agent'
const PROMPT = '@deepseek-ai/dsh-system-prompt'
const SESSIONS = '@deepseek-ai/dsh-session'
const PROJECTIONS = '@deepseek-ai/dsh-session-projection'
const DIRECTORY = '@deepseek-ai/dsh-tenant-static'
const CONFIG = '@deepseek-ai/dsh-tenant-config-static'
const STAMP = '@deepseek-ai/dsh-tenant-session'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** Boot the five rows through the real Loader. */
async function compose(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-tenant-session-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${AGENTS}'`,
    `- name: '${PROMPT}'`,
    `- name: '${SESSIONS}'`,
    `- name: '${PROJECTIONS}'`,
    `- name: '${DIRECTORY}'`,
    '  config:',
    '    tenants:',
    "      - id: 'acme'",
    "        slug: 'acme'",
    "        displayName: 'Acme'",
    `- name: '${CONFIG}'`,
    '  config:',
    '    tenants:',
    "      - tenantId: 'acme'",
    '        identity:',
    '          constraints:',
    "            - 'Never discuss unreleased figures.'",
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
    [AGENTS, AgentRegistry],
    [PROMPT, SystemPrompt],
    [SESSIONS, SessionStore],
    [PROJECTIONS, SessionProjectionRegistry],
    [DIRECTORY, StaticTenantDirectory],
    [CONFIG, StaticTenantConfigStore],
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

describe('the composed tenant stamp', () => {
  it('leaves every created session attributable and its identity reconstructable', async () => {
    const ctx = await compose()
    const session = ctx.sessions.create()

    const stamped = session.ownEvents().filter(event => event.type === 'tenant/identity')
    expect(stamped).toHaveLength(1)
    expect(stamped[0]?.data as TenantSessionRecord).toEqual({
      version: 1,
      tenantId: 'acme',
      slug: 'acme',
      constraints: ['Never discuss unreleased figures.'],
    })
    expect(ctx.sessionProjections.stateOf(session, 'tenant')).toMatchObject({ slug: 'acme' })
  })
})
