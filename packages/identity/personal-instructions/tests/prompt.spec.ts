/**
 * What the recorded instructions do: they reach the model as one section of
 * an agent's own prompt, after the deployment's persona, and they come from
 * the session's own record rather than from the store.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry, { assembleContextFor } from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import AgentLoop from '@lyness/lyn-agent-loop'
import LlmRuntime, { LlmAdapter } from '@lyness/lyn-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@lyness/lyn-llm'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt, { renderPrompt } from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import * as NativeToolExecutor from '@lyness/lyn-tool-executor-native'
import * as PersonalInstructions from '../src/index.ts'
import {
  PERSON_INSTRUCTIONS_SECTION, SOLE_OPERATOR, applyInstructionsEvent, instructionsText,
} from '../src/index.ts'

const PROVIDER = 'scripted'

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

/**
 * A deployment with everything the stamp and the prompt need.
 * @param saved - what the single operator has written, when they have.
 * @param accounts - mount a principal that names nobody, which is the shape
 * whose sessions carry no record at all.
 * @returns the booted context.
 */
async function bench(saved?: string, accounts = false): Promise<Context & { instructionsFiber: { dispose: () => Promise<void> } }> {
  const ctx = await unmounted(accounts)
  const instructionsFiber = await ctx.plugin(PersonalInstructions, {}).await()
  if (saved !== undefined) await ctx.personalInstructions.save(SOLE_OPERATOR, saved)
  return Object.assign(ctx, { instructionsFiber })
}

/**
 * Everything the stamp and the prompt need, without the plugin itself.
 * @param accounts - mount a principal that names nobody.
 * @returns the booted context.
 */
async function unmounted(accounts = false): Promise<Context> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-instructions-prompt-'))
  roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, { personaPrefix: 'Deployment.' })
  await ctx.plugin(ToolRuntime, {})
  // Upstream 0.2.1 split tool execution out of the runtime: an agent cannot
  // be created in a composition that mounts no executor.
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter([PROVIDER], new Scripted())
  if (accounts) ctx.provide('requestPrincipal', { current: () => undefined })
  return ctx
}

/** One production agent over a session the plugin stamped on creation. */
async function agentOf(ctx: Context, id: string) {
  return ctx.agents.create({
    sessionId: SessionId(id),
    agentOptions: { provider: PROVIDER, model: 'm' },
    meta: { cwd: '/w' },
  })
}

/** The prompt one agent assembles, with the agent as the scope the loop uses. */
async function promptOf(agent: Agent) {
  return agent.ctx.systemPrompt.assemble(assembleContextFor(agent))
}

describe('instructionsText', () => {
  it('introduces the text as the words the person wrote', () => {
    expect(instructionsText('Call me Sam.')).toBe(
      'The person in this conversation has written these instructions for you:\n\nCall me Sam.')
  })

  it('contributes nothing when they wrote none', () => {
    expect(instructionsText('')).toBe('')
    expect(instructionsText('   \n ')).toBe('')
  })
})

describe('applyInstructionsEvent', () => {
  it('keeps the state it was given for any other event', () => {
    const record = { version: 1, owner: SOLE_OPERATOR, text: 'Call me Sam.' }
    expect(applyInstructionsEvent(record, { type: 'session/owner', data: {} } as never)).toBe(record)
  })
})

describe('the instructions an agent runs under', () => {
  it('reaches the prompt after the deployment persona', async () => {
    const ctx = await bench('Call me Sam.')
    const { agent } = await agentOf(ctx, 'one')
    const assembly = await promptOf(agent)
    const section = assembly.sections.find(one => one.name === PERSON_INSTRUCTIONS_SECTION)
    expect(section?.text).toContain('Call me Sam.')
    // The deployment's own persona is still there and comes first: text a
    // person wrote is appended, so it cannot widen what the agent may do.
    const rendered = renderPrompt(assembly)
    expect(rendered.indexOf('Deployment.')).toBeLessThan(rendered.indexOf('Call me Sam.'))
  })

  it('carries what the session recorded, not what the store now holds', async () => {
    const ctx = await bench('Call me Sam.')
    const { agent } = await agentOf(ctx, 'one')
    await ctx.personalInstructions.save(SOLE_OPERATOR, 'Call me Alex.')
    const rendered = renderPrompt(await promptOf(agent))
    expect(rendered).toContain('Call me Sam.')
    expect(rendered).not.toContain('Call me Alex.')
  })

  it('contributes an empty section for a person who wrote none', async () => {
    const ctx = await bench()
    const { agent } = await agentOf(ctx, 'one')
    const assembly = await promptOf(agent)
    expect(assembly.sections.find(one => one.name === PERSON_INSTRUCTIONS_SECTION)?.text).toBe('')
  })

  it('composes nothing for an agent whose session carries no record', async () => {
    // A deployment with accounts, reached by nobody: the stamp wrote no
    // record, so the composition has nothing to read and contributes no
    // section at all.
    const ctx = await bench(undefined, true)
    const { agent } = await agentOf(ctx, 'one')
    const assembly = await promptOf(agent)
    expect(assembly.sections.some(one => one.name === PERSON_INSTRUCTIONS_SECTION)).toBe(false)
  })

  it('withdraws every section when the plugin unmounts', async () => {
    const ctx = await bench('Call me Sam.')
    const first = await agentOf(ctx, 'one')
    const { agent: second } = await agentOf(ctx, 'two')
    expect((await promptOf(second)).sections.some(one => one.name === PERSON_INSTRUCTIONS_SECTION)).toBe(true)
    // One agent gone first, so the plugin's own teardown reaches only the
    // sections still standing.
    const disposed: string[] = []
    ctx.on('agent/disposed', () => { disposed.push('one') })
    await first.dispose()
    expect(disposed).toEqual(['one'])
    await ctx.instructionsFiber.dispose()
    expect((await promptOf(second)).sections.some(one => one.name === PERSON_INSTRUCTIONS_SECTION)).toBe(false)
  })

  it('composes for an agent that was already running when it mounted', async () => {
    // The plugin mounts over a live agent — a composition reloaded, or a
    // deployment that mounts it late. It stamps that agent's session first
    // and composes the record it just wrote.
    const ctx = await unmounted()
    const { agent } = await agentOf(ctx, 'one')
    await ctx.plugin(PersonalInstructions, {}).await()
    const assembly = await promptOf(agent)
    expect(assembly.sections.some(one => one.name === PERSON_INSTRUCTIONS_SECTION)).toBe(true)
  })

  it('leaves another agent in this process alone', async () => {
    const ctx = await bench('Call me Sam.')
    const { agent: first } = await agentOf(ctx, 'one')
    const { agent: second } = await agentOf(ctx, 'two')
    // Each session carries its own record, so the section each agent gets is
    // the one its own log holds rather than the other's.
    for (const agent of [first, second]) {
      expect((await promptOf(agent)).sections.find(one => one.name === PERSON_INSTRUCTIONS_SECTION)?.text)
        .toContain('Call me Sam.')
    }
  })
})
