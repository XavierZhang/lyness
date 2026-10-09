/** The business-view default preset: both tool presentations and a persistent terminal in one catalog. */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { AgentHandle } from '@lyness/lyn-agent'
import { createUserMessage } from '@lyness/lyn-llm'
import { SessionId } from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-agent-preset-registry'
import type {} from '@lyness/lyn-system-prompt'
import { assertFixtureInventory, launchWebScaffold, type WebScaffold } from './scaffold.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('../../../snapshots/web/work-preset', import.meta.url))
const FIXTURE = join(SNAPSHOT_DIR, 'session.v4.jsonl')
const PROMPT = "Use the bash tool to run exactly: printf 'WORK_BASH_CARD_OK\\n'. Then reply exactly WORK_PRESET_REQUEST_OK and stop."

/** The persistent-terminal tools the preset's isolated terminal group contributes. */
const TERMINAL_TOOLS = [
  'terminal_open', 'terminal_send', 'terminal_read', 'terminal_signal', 'terminal_close', 'terminal_list',
]

/** Rendered text of the system prompt surface node, or undefined when the surface carries none. */
function systemPromptText(session: Session): string | undefined {
  const message = session.deriveMessages().find(candidate => candidate.role === 'system')
  return message?.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}

describe('work agent preset', () => {
  let scaffold: WebScaffold
  let agentHandle: AgentHandle

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, compareReplaySession: true, paceMs: 10 })
    agentHandle = await scaffold.ctx.agents.create({
      sessionId: SessionId('work-preset-smoke'),
      meta: { cwd: scaffold.workspaceCwd, agentPreset: 'work' },
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      setup: agentCtx => scaffold.ctx.agentPresets.mount(agentCtx, 'work').then(() => undefined),
    })
    agentHandle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: PROMPT }],
      source: { kind: 'user' },
    }))
    await agentHandle.agent.whenIdle()
  })

  afterAll(async () => {
    const failures: unknown[] = []
    await agentHandle?.dispose().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'work preset smoke teardown failed')
  })

  it('presents both tool forms beside a persistent terminal and the coding tools', () => {
    const requestHeader = agentHandle.agent.session.requestHeader()
    if (requestHeader === undefined) throw new Error('the work agent issued no model request')
    const names = requestHeader.tools?.map(tool => tool.name) ?? []

    // `mode: both` sends the PTC transport and every native schema in one catalog,
    // which is what carries `standard` and `ptc` capabilities in a single preset.
    expect(names).toContain('run_code')
    expect(names).toContain('bash')
    expect(names).toEqual(expect.arrayContaining(TERMINAL_TOOLS))

    // The business view keeps the whole `standard` surface, not a reduced one.
    expect(names).toEqual(expect.arrayContaining(['read', 'write', 'edit', 'web_search', 'skill', 'todo_write']))
    expect(scaffold.ctx.commands.find(agentHandle.agent, 'goal')).not.toBeUndefined()

    // The prompt is the composed harness prompt, not `minimal`'s closed one-liner.
    expect(systemPromptText(agentHandle.agent.session)).toContain('Your working directory is')

    expect(requestHeader.tools?.toSorted((left, right) => left.name.localeCompare(right.name)))
      .toEqual(scaffold.ctx.tools.schemas(agentHandle.agent).toSorted((left, right) => left.name.localeCompare(right.name)))
  })

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, [
      'session.v4.jsonl',
      'system-prompt.expected.md',
      'tool-schemas.expected.json',
    ])
  })
})
