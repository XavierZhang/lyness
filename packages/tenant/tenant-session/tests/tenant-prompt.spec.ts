/**
 * What the recorded identity does: it reaches the model as two sections of an
 * agent's own prompt, after the deployment's persona and before its policy,
 * and it comes from the session's own record — so a tenant editing its
 * identity does not change what a conversation already said.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry, { assembleContextFor } from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import AgentLoop from '@lyness/lyn-agent-loop'
import LlmRuntime, { LlmAdapter } from '@lyness/lyn-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@lyness/lyn-llm'
import SessionStore, { SessionId } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt, { renderPrompt } from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import * as NativeToolExecutor from '@lyness/lyn-tool-executor-native'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import StaticTenantConfigStore from '@lyness/lyn-tenant-config-static'
import type { Config as StaticTenantConfig } from '@lyness/lyn-tenant-config-static'
import * as TenantSession from '../src/index.ts'
import {
  composeTenantIdentity, constraintsText, TENANT_CONSTRAINTS_SECTION, TENANT_PERSONALITY_SECTION,
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

const ROSTER = { tenants: [{ id: 'acme', slug: 'acme', displayName: 'Acme' }] }
const CONFIGURED: StaticTenantConfig = {
  tenants: [{
    tenantId: 'acme',
    identity: {
      constraints: ['Never discuss unreleased figures.', 'Answer in the customer\'s own language.'],
      personality: 'Answer briefly and name the source.',
    },
  }],
}

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A deployment with everything the stamp needs, but without the stamp itself. */
async function unstamped(config: StaticTenantConfig = CONFIGURED): Promise<Context> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(LlmRuntime)
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
  await ctx.plugin(StaticTenantDirectory, ROSTER)
  await ctx.plugin(StaticTenantConfigStore, config).await()
  return ctx
}

/** A deployment that stamps its sessions and composes what it stamped. */
async function bench(config: StaticTenantConfig = CONFIGURED): Promise<Context> {
  const ctx = await unstamped(config)
  await ctx.plugin(TenantSession, { tenantId: 'acme' }).await()
  return ctx
}

/**
 * The prompt one agent assembles.
 *
 * Assembled with the agent as the scope, the way the loop does it: a prompt
 * assembled without one carries the deployment's own sections and nothing a
 * conversation contributed.
 * @param agent - whose prompt to assemble.
 * @returns that agent's assembly.
 */
async function promptOf(agent: Agent) {
  return agent.ctx.systemPrompt.assemble(assembleContextFor(agent))
}

/**
 * One production agent, whose session the plugin stamped on creation.
 *
 * Created through the registry rather than the loop directly, so the test owns
 * the handle that disposes it and can observe what disposal withdraws.
 */
async function agentOf(ctx: Context, id: string) {
  return ctx.agents.create({
    sessionId: SessionId(id),
    agentOptions: { provider: PROVIDER, model: 'm' },
    meta: { cwd: '/w' },
  })
}

describe('the identity an agent runs under', () => {
  it('reaches the prompt as two sections, after the deployment persona', async () => {
    const ctx = await bench()
    const { agent } = await agentOf(ctx, 'one')

    const assembly = await promptOf(agent)
    const personality = assembly.sections.find(one => one.name === TENANT_PERSONALITY_SECTION)
    const constraints = assembly.sections.find(one => one.name === TENANT_CONSTRAINTS_SECTION)

    expect(personality?.text).toBe('Answer briefly and name the source.')
    expect(constraints?.text).toBe(
      'The organization this conversation belongs to requires:\n\n'
      + '- Never discuss unreleased figures.\n'
      + '- Answer in the customer\'s own language.',
    )
    // The deployment's own persona is still there and comes first: text a
    // customer wrote is appended, so it cannot widen what the agent may do.
    const rendered = renderPrompt(assembly)
    expect(rendered).toContain('Deployment.')
    expect(rendered.indexOf('Deployment.')).toBeLessThan(rendered.indexOf('Answer briefly'))
    expect(rendered.indexOf('Answer briefly')).toBeLessThan(rendered.indexOf('The organization this conversation'))
  })

  it('leaves another agent in this process alone', async () => {
    const ctx = await bench()
    const first = await agentOf(ctx, 'one')
    const second = await agentOf(ctx, 'two')

    // Composed on each agent's own context, so one conversation's identity is
    // never assembled into another's.
    for (const { agent } of [first, second]) {
      const assembly = await promptOf(agent)
      expect(assembly.sections.find(one => one.name === TENANT_PERSONALITY_SECTION)?.text)
        .toBe('Answer briefly and name the source.')
    }
    await second.dispose()
    expect((await promptOf(first.agent))
      .sections.find(one => one.name === TENANT_PERSONALITY_SECTION)).toBeDefined()
  })

  it('carries no section for a tenant that configured no identity', async () => {
    const ctx = await bench({ tenants: [{ tenantId: 'acme' }] })
    const { agent } = await agentOf(ctx, 'one')

    const assembly = await promptOf(agent)
    // Empty text drops the section at render, so a tenant that asked for
    // nothing contributes nothing rather than an empty heading.
    expect(assembly.sections.find(one => one.name === TENANT_PERSONALITY_SECTION)?.text).toBe('')
    expect(assembly.sections.find(one => one.name === TENANT_CONSTRAINTS_SECTION)?.text).toBe('')
    expect(renderPrompt(assembly)).not.toContain('The organization this conversation')
  })

  it('composes for an agent that already existed when the plugin mounted', async () => {
    const ctx = await unstamped()
    const early = await agentOf(ctx, 'one')
    // The plugin mounts after the agent does: it stamps the session this agent
    // is already running, and composes what it stamped.
    await ctx.plugin(TenantSession, { tenantId: 'acme' }).await()

    expect((await promptOf(early.agent))
      .sections.filter(one => one.name === TENANT_PERSONALITY_SECTION)).toHaveLength(1)
  })

  it('withdraws the sections when this plugin unmounts, and forgets a disposed agent', async () => {
    const ctx = await unstamped()
    const handle = await agentOf(ctx, 'one')
    const second = await agentOf(ctx, 'two')
    const mounted = await ctx.plugin(TenantSession, { tenantId: 'acme' }).await()
    await second.dispose()

    // A registry contribution proves its own disposal: unmounting the plugin
    // takes the sections off agent contexts its own teardown does not unwind.
    await mounted.dispose()
    expect((await promptOf(handle.agent))
      .sections.filter(one => one.name === TENANT_PERSONALITY_SECTION)).toHaveLength(0)
  })

  it('withdraws the sections when the agent is disposed', async () => {
    const ctx = await bench()
    const handle = await agentOf(ctx, 'one')
    expect((await promptOf(handle.agent))
      .sections.find(one => one.name === TENANT_CONSTRAINTS_SECTION)).toBeDefined()

    await handle.dispose()
    // The root prompt never carried them: they belong to one agent's scope.
    expect((await ctx.systemPrompt.assemble())
      .sections.find(one => one.name === TENANT_CONSTRAINTS_SECTION)).toBeUndefined()
  })
})

describe('composing one record on its own', () => {
  it('registers both sections and withdraws both', async () => {
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin(SystemPrompt, { personaPrefix: 'Deployment.' })

    const withdraw = composeTenantIdentity(ctx, {
      version: 1,
      tenantId: 'acme',
      slug: 'acme',
      constraints: ['Cite the source.'],
      personality: 'Answer briefly.',
    })
    const named = (await ctx.systemPrompt.assemble()).sections.map(one => one.name)
    expect(named).toContain(TENANT_PERSONALITY_SECTION)
    expect(named).toContain(TENANT_CONSTRAINTS_SECTION)

    withdraw()
    const after = (await ctx.systemPrompt.assemble()).sections.map(one => one.name)
    expect(after).not.toContain(TENANT_PERSONALITY_SECTION)
    expect(after).not.toContain(TENANT_CONSTRAINTS_SECTION)
  })
})

describe('the rules as the model reads them', () => {
  it('names the organization rather than this deployment\'s word for its customers', () => {
    expect(constraintsText(['Cite the source.']))
      .toBe('The organization this conversation belongs to requires:\n\n- Cite the source.')
  })

  it('contributes nothing for no rules, and skips an empty one', () => {
    expect(constraintsText([])).toBe('')
    expect(constraintsText(['', ''])).toBe('')
    expect(constraintsText(['', 'Cite the source.']))
      .toBe('The organization this conversation belongs to requires:\n\n- Cite the source.')
  })
})
