import { Context } from '@lyness/cordis'
import Sandbox from '@lyness/lyn-sandbox-local'
import SandboxPolicy from '@lyness/lyn-sandbox-policy'
import SessionProjections from '@lyness/lyn-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@lyness/lyn-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}
