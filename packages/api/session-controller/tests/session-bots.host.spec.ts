/**
 * Opening a conversation with a bot: the composition comes from the bot's own
 * preset, the character it ran with is written into that session's log, and
 * the two requests that cannot mean one thing are refused rather than
 * resolved one way.
 */

import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import { agentPresetProjectionDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { botProjectionDefinition } from '@deepseek-ai/dsh-managed-bots/session'
import type { EngagedBot } from '@deepseek-ai/dsh-managed-bots/session'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { afterEach, describe, expect, it } from 'vitest'
import { BotsRefusedError } from '@deepseek-ai/dsh-managed-bots'
import { createSessionTestRemote } from './test-remote.ts'

const ADA = brandString<PersonId>('ada')
const ADA_STANDING = brandString<MembershipId>('ada:platform-administrator')

const contexts: Context[] = []
const tempDirs: string[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** One bot the roster answers for. */
const TRIAGE: EngagedBot = {
  bot: 'triage',
  displayName: 'Triage',
  persona: 'You answer in short sentences.',
}

function stubAgent(ctx: Context, session: Session): Agent {
  return { id: session.id, session, status: 'idle', ctx } as Agent
}

/** A preset registry offering exactly these ids. */
function presets(ids: readonly string[]): unknown {
  const presetOf = (id: string): object => ({ id, trust: 'system' })
  return {
    defaultId: ids[0],
    resolve: (id?: string) => Promise.resolve(presetOf(id ?? ids[0] ?? '')),
    mount: (_ctx: Context, id?: string) => Promise.resolve(presetOf(id ?? ids[0] ?? '')),
  }
}

/**
 * The deployment, with a roster when one is asked for.
 * @param options - which bots the roster answers for, and whether it exists.
 */
async function harness(options: { roster?: boolean; standing?: 'none' | 'elsewhere' } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-session-bots-')))
  tempDirs.push(cwd)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  ctx.provide('agentPresets', presets(['standard', 'specialist']) as never)
  // Speaking as a bot acts in a standing; the roster judges it, and this
  // supplies the one a signed-in request would carry.
  ctx.provide('requestPrincipal', {
    current: () => options.standing === 'none'
      ? undefined
      : { person: ADA, acting: { person: ADA, membership: ADA_STANDING } },
  })
  ctx.provide('people', {
    person: () => Promise.resolve(undefined),
    membership: () => Promise.resolve(options.standing === 'elsewhere'
      ? { id: ADA_STANDING, person: ADA, role: 'member', organization: 'other' }
      : { id: ADA_STANDING, person: ADA, role: 'platform-administrator' }),
    memberships: () => Promise.resolve([]),
  } as never)

  const composed: EngagedBot[] = []
  if (options.roster !== false) {
    // The real roster reads its records and renders a prompt section; what
    // this controller does with it is which preset it composes and what it
    // writes into the log.
    ctx.provide('managedBots', {
      engage: (id: string, by: { role: string; organization?: string }) => {
        if (id !== TRIAGE.bot) return Promise.resolve(undefined)
        // The real roster refuses a standing from elsewhere; this records
        // that the controller hands it the standing to judge.
        if (by.role !== 'platform-administrator' && by.organization !== 'acme') {
          return Promise.reject(new BotsRefusedError('not-yours', 'that bot belongs to another organization'))
        }
        return Promise.resolve({ preset: 'specialist', engaged: TRIAGE })
      },
      compose: (_agentCtx: Context, engaged: EngagedBot) => { composed.push(engaged); return () => {} },
    } as never)
  }

  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options_) {
      const session = ctx.sessions.create(
        options_.sessionId,
        options_.meta === undefined ? {} : { meta: options_.meta },
      )
      const agent = stubAgent(ctx, session)
      await options_.setup?.(ctx, agent)
      const unregister = await ctx.agents.register(agent)
      return { agent, dispose: async () => { await unregister() } }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  const remote = createSessionTestRemote(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd,
  })
  ctx.sessionProjections.register(agentPresetProjectionDefinition)
  ctx.sessionProjections.register(botProjectionDefinition)
  return { ctx, remote, composed }
}

/** The engagement events one session recorded. */
function engagements(ctx: Context, id: string): unknown[] {
  const session = ctx.sessions.get(SessionId(id))
  if (session === undefined) throw new Error(`no session "${id}"`)
  return session.snapshotEvents().filter(event => event.type === 'bot/engaged').map(event => event.data)
}

describe('a conversation with a bot', () => {
  it('runs the bot\'s own preset and records the character it ran with', async () => {
    const { ctx, remote, composed } = await harness()

    const created = await remote.create({ sessionId: SessionId('b1'), bot: 'triage' })

    expect(created).toMatchObject({ ok: true, value: { bot: 'triage', agentPreset: 'specialist' } })
    expect(ctx.sessions.get(SessionId('b1'))?.header.agentPreset).toBe('specialist')
    // Composed into the agent, and written into that session's own log: the
    // log is what a resume rebuilds from, so an administrator who rewrites
    // the character later does not rewrite this conversation.
    expect(composed).toEqual([TRIAGE])
    expect(engagements(ctx, 'b1')).toEqual([TRIAGE])
  })

  it('leaves an ordinary session alone', async () => {
    const { ctx, remote, composed } = await harness()
    const created = await remote.create({ sessionId: SessionId('b2') })

    expect(created).toMatchObject({ ok: true })
    expect((created as { value: { bot?: string } }).value.bot).toBeUndefined()
    expect(composed).toEqual([])
    expect(engagements(ctx, 'b2')).toEqual([])
  })
})

describe('what the surface refuses', () => {
  it('refuses a request naming both a bot and a preset', async () => {
    const { remote } = await harness()
    // A bot's preset is the bot's: honouring both would run a character
    // under a composition its author never gave it.
    await expect(remote.create({ sessionId: SessionId('b3'), bot: 'triage', agentPreset: 'standard' }))
      .resolves.toMatchObject({ ok: false, error: { code: 'gateway/bad-request' } })
  })

  it('refuses a bot nobody maintains, before the session exists', async () => {
    const { ctx, remote } = await harness()
    await expect(remote.create({ sessionId: SessionId('b4'), bot: 'ghost' }))
      .resolves.toMatchObject({ ok: false, error: { code: 'session/not-found' } })
    expect(ctx.sessions.get(SessionId('b4'))).toBeUndefined()
  })

  it('refuses a standing from another organization, and one that establishes none', async () => {
    // Knowing a bot's id is not permission to be it.
    const elsewhere = await harness({ standing: 'elsewhere' })
    await expect(elsewhere.remote.create({ sessionId: SessionId('b6'), bot: 'triage' }))
      .resolves.toMatchObject({ ok: false, error: { code: 'session/bot-forbidden' } })

    const anonymous = await harness({ standing: 'none' })
    await expect(anonymous.remote.create({ sessionId: SessionId('b7'), bot: 'triage' }))
      .resolves.toMatchObject({ ok: false, error: { code: 'session/bot-forbidden' } })
  })

  it('says a deployment with no roster maintains no bots', async () => {
    const { remote } = await harness({ roster: false })
    await expect(remote.create({ sessionId: SessionId('b5'), bot: 'triage' }))
      .resolves.toMatchObject({ ok: false, error: { code: 'gateway/internal' } })
  })
})
