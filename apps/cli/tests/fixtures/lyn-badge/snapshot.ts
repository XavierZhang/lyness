import { executeToolFixture } from '@lyness/lyn-tool-testkit'
import { fileURLToPath } from 'node:url'
import { agentEvents, type Agent } from '@lyness/lyn-agent'
import { ToolCallId } from '@lyness/lyn-llm'
import { boot, loadOverlayPatches } from '@lyness/lyn-app-boot'
import { SessionId } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-skill'
import type {} from '@lyness/lyn-tools'
import { unsupportedModel, unsupportedInbox } from '@lyness/lyn-agent-loop-testkit'

const overlayPath = process.argv[2]
if (overlayPath === undefined) throw new Error('lyn-badge snapshot requires an overlay path')
const rootConfigPath = fileURLToPath(new URL('../../../../../packages/bundle/base/tests/fixtures/root.cordis.yml', import.meta.url))
const basePatchPath = fileURLToPath(new URL('../../../../../packages/bundle/base/cordis.patch.yml', import.meta.url))
// The fixture owns the optional provider; the base bundle has no dependency on it.
const overlays = loadOverlayPatches('lyn-badge-snapshot', overlayPath).map(patch => patch.insert === undefined ? patch : {
  ...patch,
  insert: patch.insert.map(row => row.name === '@lyness/lyn-skill-badge'
    ? { ...row, name: import.meta.resolve('@lyness/lyn-skill-badge') }
    : row),
})
const ctx = await boot('lyn-badge-snapshot', rootConfigPath, [
  ...loadOverlayPatches('lyn-badge-snapshot', basePatchPath),
  ...overlays,
])

try {
  const agentId = SessionId('lyn-badge-snapshot')
  const session = ctx.sessions.create(agentId, { meta: { cwd: process.cwd() } })
  const agent: Agent = {
    ctx,
    id: agentId,
    options: {},
    session,
    model: unsupportedModel(),
    inbox: unsupportedInbox(),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('lyn-badge snapshot must receive the catalog at the step boundary') },
    cancel: () => {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { modelSelection: { provider: 'mock', model: 'mock' }, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: 'enter' as const, messages: [] }),
  )
  const catalog = decision.kind === 'enter'
    ? decision.messages.find(message => message.role === 'user'
      && message.source.kind === 'skill-catalog')?.content
    : undefined
  const summary = (await ctx.skills.list()).find(skill => skill.name === 'lyn-badge')
  const result = await executeToolFixture(ctx, {
    callId: ToolCallId('lyn-badge-snapshot'),
    name: 'skill',
    arguments: { name: 'lyn-badge' },
    signal: new AbortController().signal,
  })
  process.stdout.write(`${JSON.stringify({ catalog: catalog ?? null, summary: summary ?? null, result })}\n`)
} finally {
  await ctx.fiber.dispose()
}
