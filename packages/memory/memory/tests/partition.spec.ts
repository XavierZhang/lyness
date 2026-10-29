/**
 * Whose memories one reader sees: a person's own plus the deployment's
 * shared, never a third person's — in the prompt, in `memory_list`, and in
 * what `memory_forget` can reach.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import AgentLoop from '@lyness/lyn-agent-loop'
import LlmRuntime, { LlmAdapter } from '@lyness/lyn-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@lyness/lyn-llm'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt, { renderContextSnapshot } from '@lyness/lyn-system-prompt'
import Tools from '@lyness/lyn-tools'
import * as NativeToolExecutor from '@lyness/lyn-tool-executor-native'
import { assembleContextFor } from '@lyness/lyn-agent'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { SESSION_OWNER_RECORD_VERSION } from '@lyness/lyn-session-ownership/types'
import MemoryService, { memoryOwnerOfPerson, personalKey, readPersonalKey } from '../src/index.ts'
import type { MemoryPartitionKey } from '../src/types.ts'
import type { MemoryId } from '../src/types.ts'

const PROVIDER = 'scripted'
const ADA = brandString<PersonId>('ada')
const BO = brandString<PersonId>('bo')

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

const roots: string[] = []
const live: Context[] = []
afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A deployment with sessions, agents, the prompt, and memory. */
async function bench(root = mkdtempSync(join(tmpdir(), 'lyn-memory-partition-'))): Promise<Context> {
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(Tools, {})
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter([PROVIDER], new Scripted())
  await ctx.plugin(MemoryService, {}).await()
  return ctx
}

/** One agent over a session attributed to `person`, or to nobody. */
async function agentOf(ctx: Context, id: string, person?: PersonId): Promise<Agent> {
  const { agent } = await ctx.agents.create({
    sessionId: SessionId(id),
    agentOptions: { provider: PROVIDER, model: 'm' },
    meta: { cwd: '/w' },
  })
  // The record `session-ownership` would have written, appended here so this
  // spec needs neither the request principal nor the client transport.
  if (person !== undefined) {
    agent.session.append('session/owner', {
      version: SESSION_OWNER_RECORD_VERSION,
      owner: person,
      openedAt: '2026-10-29T00:00:00.000Z',
    })
  }
  return agent
}

/** What one agent's prompt carries as runtime context. */
async function contextOf(agent: Agent): Promise<string> {
  return renderContextSnapshot(await agent.ctx.systemPrompt.assemble(assembleContextFor(agent)))
}

/** Remember one fact as the person whose conversation this agent is. */
async function rememberAs(ctx: Context, agent: Agent, text: string, scope: 'member' | 'shared' = 'member') {
  return ctx.agents.withInitiator(agent, () => ctx.memory.remember(text, scope))
}

describe('whose memories reach a prompt', () => {
  it('carries a person their own and the deployment shared, and not another person', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const bo = await agentOf(ctx, 'bo-one', BO)
    await rememberAs(ctx, ada, 'Ada prefers metric units.')
    await rememberAs(ctx, bo, 'Bo prefers imperial units.')
    await rememberAs(ctx, ada, 'The office is closed on Fridays.', 'shared')

    const seenByAda = await contextOf(ada)
    expect(seenByAda).toContain('Ada prefers metric units.')
    expect(seenByAda).toContain('The office is closed on Fridays.')
    expect(seenByAda).not.toContain('Bo prefers imperial units.')

    const seenByBo = await contextOf(bo)
    expect(seenByBo).toContain('Bo prefers imperial units.')
    expect(seenByBo).toContain('The office is closed on Fridays.')
    expect(seenByBo).not.toContain('Ada prefers metric units.')
  })

  it('carries only the shared entries to a conversation nobody owns', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const nobody = await agentOf(ctx, 'cli-one')
    await rememberAs(ctx, ada, 'Ada prefers metric units.')
    await rememberAs(ctx, ada, 'The office is closed on Fridays.', 'shared')

    const seen = await contextOf(nobody)
    expect(seen).toContain('The office is closed on Fridays.')
    expect(seen).not.toContain('Ada prefers metric units.')
  })

  it('writes to the shared table when no conversation owns the write', async () => {
    const ctx = await bench()
    // A single-operator deployment attributes no session, so a member write
    // lands where it always has and every reader keeps seeing it.
    const record = await ctx.memory.remember('Deploy on Tuesdays.')
    expect(record.owner).toBeUndefined()
    const nobody = await agentOf(ctx, 'cli-one')
    expect(await contextOf(nobody)).toContain('Deploy on Tuesdays.')
  })
})

describe('what the tools can reach', () => {
  it('lists a person their own and the shared, in write order', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const bo = await agentOf(ctx, 'bo-one', BO)
    await rememberAs(ctx, ada, 'Ada prefers metric units.')
    await rememberAs(ctx, bo, 'Bo prefers imperial units.')
    const listed = await ctx.agents.withInitiator(ada, () => ctx.memory.list())
    expect(listed.map(one => one.text)).toEqual(['Ada prefers metric units.'])
  })

  it('refuses to forget a fact the caller cannot see', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const bo = await agentOf(ctx, 'bo-one', BO)
    const theirs = await rememberAs(ctx, bo, 'Bo prefers imperial units.')
    // Ada's agent holds Bo's id — the only way it could, in a test — and
    // still removes nothing.
    expect(await ctx.agents.withInitiator(ada, () => ctx.memory.forget(theirs.id))).toBe(false)
    expect(await ctx.agents.withInitiator(bo, () => ctx.memory.list()))
      .toEqual([expect.objectContaining({ text: 'Bo prefers imperial units.' })])
  })

  it('forgets a person their own fact from their own conversation', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const mine = await rememberAs(ctx, ada, 'Ada prefers metric units.')
    expect(await ctx.agents.withInitiator(ada, () => ctx.memory.forget(mine.id))).toBe(true)
    expect(await ctx.memory.listOwnedBy(memoryOwnerOfPerson(ADA))).toEqual([])
  })

  it('forgets a shared fact from any conversation', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const shared = await rememberAs(ctx, ada, 'The office is closed on Fridays.', 'shared')
    const bo = await agentOf(ctx, 'bo-one', BO)
    expect(await ctx.agents.withInitiator(bo, () => ctx.memory.forget(shared.id))).toBe(true)
  })
})

describe('a personal key', () => {
  it('reads back the owner and the id it was built from', () => {
    const owner = memoryOwnerOfPerson(ADA)
    const id = brandString<MemoryId>('abc')
    expect(readPersonalKey(personalKey(owner, id))).toEqual({ owner, id })
  })

  it('reads back nothing from a key this package did not write', () => {
    // No separator, nothing before it, nothing after it: each would make an
    // owner up, and a guessed owner shows one person another's memory.
    for (const raw of ['', 'no-separator', '/only-an-id', 'only-an-owner/']) {
      expect(readPersonalKey(brandString<MemoryPartitionKey>(raw))).toBeUndefined()
    }
  })
})

describe('the personal reads a page uses', () => {
  it('reads one person their own entries and no shared ones', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    await rememberAs(ctx, ada, 'Ada prefers metric units.')
    await rememberAs(ctx, ada, 'The office is closed on Fridays.', 'shared')
    const owned = await ctx.memory.listOwnedBy(memoryOwnerOfPerson(ADA))
    expect(owned.map(one => one.text)).toEqual(['Ada prefers metric units.'])
  })

  it('removes one of their own, and nothing of anybody else', async () => {
    const ctx = await bench()
    const ada = await agentOf(ctx, 'ada-one', ADA)
    const bo = await agentOf(ctx, 'bo-one', BO)
    const mine = await rememberAs(ctx, ada, 'Ada prefers metric units.')
    const theirs = await rememberAs(ctx, bo, 'Bo prefers imperial units.')
    expect(await ctx.memory.forgetOwnedBy(memoryOwnerOfPerson(ADA), theirs.id)).toBe(false)
    expect(await ctx.memory.forgetOwnedBy(memoryOwnerOfPerson(ADA), mine.id)).toBe(true)
    expect(await ctx.memory.listOwnedBy(memoryOwnerOfPerson(ADA))).toEqual([])
    expect(await ctx.memory.listOwnedBy(memoryOwnerOfPerson(BO))).toHaveLength(1)
  })

  it('reports nothing for a person who has written none', async () => {
    const ctx = await bench()
    expect(await ctx.memory.listOwnedBy(memoryOwnerOfPerson(ADA))).toEqual([])
    expect(await ctx.memory.forgetOwnedBy(memoryOwnerOfPerson(ADA), brandString<MemoryId>('absent'))).toBe(false)
  })
})

describe('a durable write that fails', () => {
  it('carries the failure back to its own caller', async () => {
    const ctx = await bench()
    const memory = ctx.memory
    await ctx.fiber.dispose()
    live.splice(live.indexOf(ctx), 1)
    // The store is closed; the write fails loudly rather than reading as a
    // fact that was remembered.
    await expect(memory.remember('Deploy on Tuesdays.')).rejects.toThrow()
  })
})

describe('what was stored before owners were recorded', () => {
  it('stays visible to everybody, which is what it has always been', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-memory-legacy-'))
    writeFileSync(join(root, 'memory.json'), `${JSON.stringify({
      unit: { name: 'memory', version: 1 },
      global: null,
      tables: {
        entries: {
          old: { text: 'Written before anybody was named.', scope: 'member', writtenAt: '2026-10-01T00:00:00.000Z' },
        },
      },
    }, null, 2)}\n`, 'utf8')
    const ctx = await bench(root)
    const ada = await agentOf(ctx, 'ada-one', ADA)
    expect(await contextOf(ada)).toContain('Written before anybody was named.')
    // It is nobody's personal entry, so it does not appear on anybody's page.
    expect(await ctx.memory.listOwnedBy(memoryOwnerOfPerson(ADA))).toEqual([])
  })
})
