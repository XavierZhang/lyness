/**
 * REAL-composition coverage: the memory store and the namespace booted
 * through the vendored Loader beside the directory and the request principal,
 * so what is asserted is the answer a surface actually receives — including
 * that one person's call never reaches another's record.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { StaticPeopleDirectory } from '@lyness/lyn-people/static'
import * as StoredAuthSessions from '@lyness/lyn-auth-session/store'
import * as RequestPrincipal from '@lyness/lyn-request-principal'
import { IDENTITY_COOKIE } from '@lyness/lyn-request-principal'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import MemoryService, { memoryOwnerOfPerson } from '@lyness/lyn-memory'
import AgentRegistry from '@lyness/lyn-agent'
import ToolRuntime from '@lyness/lyn-tools'
import AgentLoop from '@lyness/lyn-agent-loop'
import LlmRuntime, { LlmAdapter } from '@lyness/lyn-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@lyness/lyn-llm'
import { SessionId } from '@lyness/lyn-session'
import { SESSION_OWNER_RECORD_VERSION } from '@lyness/lyn-session-ownership/types'
import * as NativeToolExecutor from '@lyness/lyn-tool-executor-native'
import SessionStore from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import MemoryController from '../src/index.ts'

/** An adapter no turn in this spec runs; the loop needs a route to exist. */
class Scripted extends LlmAdapter {
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ok' } }
  }
}

const ADA = brandString<PersonId>('ada')
const BO = brandString<PersonId>('bo')

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  context = undefined
  root = undefined
})

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

/** Boot the rows through the real Loader, and keep the request scope they registered. */
async function compose(): Promise<{ ctx: Context; scopes: Scope[] }> {
  root = await mkdtemp(join(tmpdir(), 'lyn-memory-controller-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-people/static'",
    '  config:',
    '    people:',
    '      - id: ada',
    '        displayName: Ada',
    '      - id: bo',
    '        displayName: Bo',
    "- name: '@lyness/lyn-auth-session/store'",
    "- name: '@lyness/lyn-request-principal'",
    "- name: '@lyness/lyn-session'",
    "- name: '@lyness/lyn-session-projection'",
    "- name: '@lyness/lyn-system-prompt'",
    "- name: '@lyness/lyn-tools'",
    "- name: '@lyness/lyn-tool-executor-native'",
    "- name: '@lyness/lyn-llm'",
    "- name: '@lyness/lyn-agent'",
    "- name: '@lyness/lyn-agent-loop'",
    '  config:',
    '    agents: []',
    "- name: '@lyness/lyn-memory'",
    "- name: '@lyness/lyn-api-memory-controller'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  const scopes: Scope[] = []
  ctx.provide('connection', {
    rpc: { scope: (scope: Scope) => { scopes.push(scope); return () => Promise.resolve() } },
  })
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-people/static', StaticPeopleDirectory],
    ['@lyness/lyn-auth-session/store', StoredAuthSessions],
    ['@lyness/lyn-request-principal', RequestPrincipal],
    ['@lyness/lyn-session', SessionStore],
    ['@lyness/lyn-session-projection', SessionProjectionRegistry],
    ['@lyness/lyn-system-prompt', SystemPrompt],
    ['@lyness/lyn-tools', ToolRuntime],
    ['@lyness/lyn-tool-executor-native', NativeToolExecutor],
    ['@lyness/lyn-llm', LlmRuntime],
    ['@lyness/lyn-agent', AgentRegistry],
    ['@lyness/lyn-agent-loop', AgentLoop],
    ['@lyness/lyn-memory', MemoryService],
    ['@lyness/lyn-api-memory-controller', MemoryController],
  ])
  const base = ctx.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  ctx.loader.internal = {
    ...base,
    import: (specifier: string) => {
      const found = modules.get(specifier)
      if (found === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(found)
    },
  }
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  ctx.llm.registerAdapter(['scripted'], new Scripted())
  return { ctx, scopes }
}

/**
 * Remember one fact inside a conversation this person owns, which is what an
 * agent of theirs does.
 * @param ctx - the booted context.
 * @param person - whose conversation it is.
 * @param text - the fact to keep.
 * @returns the stored record.
 */
async function rememberAs(ctx: Context, person: PersonId, text: string) {
  const { agent } = await ctx.agents.create({
    sessionId: SessionId(`${String(person)}-${String(text.length)}`),
    agentOptions: { provider: 'scripted', model: 'm' },
    meta: { cwd: '/w' },
  })
  agent.session.append('session/owner', {
    version: SESSION_OWNER_RECORD_VERSION,
    owner: person,
    openedAt: '2026-10-29T00:00:00.000Z',
  })
  return ctx.agents.withInitiator(agent, () => ctx.memory.remember(text, 'member'))
}

/** Run one call inside the request scope the presented identity session opens. */
async function asPerson<T>(
  ctx: Context, scopes: readonly Scope[], person: PersonId, run: () => Promise<T>,
): Promise<T | undefined> {
  const established = await ctx.authSessions.establish({ person, method: 'test' })
  const request = new Request('http://127.0.0.1/api', {
    headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` },
  })
  let seen: T | undefined
  for (const scope of scopes) {
    await scope(request, async () => { seen = await run() })
  }
  return seen
}

it('tells a call that presented no identity that it owns nothing', async () => {
  const { ctx } = await compose()
  expect(await ctx.memoryController.list()).toEqual({ owned: false, entries: [] })
})

it('keeps one person\'s memories out of another\'s read, and out of their removal', async () => {
  const { ctx, scopes } = await compose()
  const hers = await rememberAs(ctx, ADA, 'Ada prefers metric units.')
  await rememberAs(ctx, BO, 'Bo prefers imperial units.')

  expect(await asPerson(ctx, scopes, ADA, () => ctx.memoryController.list())).toEqual({
    owned: true,
    entries: [expect.objectContaining({ text: 'Ada prefers metric units.' })],
  })
  expect(await asPerson(ctx, scopes, BO, () => ctx.memoryController.list())).toEqual({
    owned: true,
    entries: [expect.objectContaining({ text: 'Bo prefers imperial units.' })],
  })

  // Bo holds Ada's id — the only way they could, in a test — and removing it
  // takes nothing, because the owner is derived rather than named.
  await asPerson(ctx, scopes, BO, () => ctx.memoryController.forget(String(hers.id)))
  expect(await asPerson(ctx, scopes, ADA, () => ctx.memoryController.list())).toEqual({
    owned: true,
    entries: [expect.objectContaining({ text: 'Ada prefers metric units.' })],
  })

  // Her own removal lands.
  await asPerson(ctx, scopes, ADA, () => ctx.memoryController.forget(String(hers.id)))
  expect(await asPerson(ctx, scopes, ADA, () => ctx.memoryController.list()))
    .toEqual({ owned: true, entries: [] })
})

it('refuses a removal from a call that presented no identity', async () => {
  const { ctx } = await compose()
  await expect(ctx.memoryController.forget('one')).rejects.toThrow(/speaks for nobody/u)
})

it('derives the same owner the store writes under', async () => {
  const { ctx, scopes } = await compose()
  const seen = await asPerson(ctx, scopes, ADA, () => Promise.resolve(memoryOwnerOfPerson(ADA)))
  expect(seen).toBe(memoryOwnerOfPerson(ADA))
})
