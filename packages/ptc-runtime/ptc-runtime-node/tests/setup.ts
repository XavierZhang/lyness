import { Context } from '@lyness/cordis'
import { onTestFinished } from 'vitest'
import SessionStore from '@lyness/lyn-session'
import FileSystem from '@lyness/lyn-fs-local'
import Subprocess from '@lyness/lyn-subprocess-local'
import Sandbox from '@lyness/lyn-sandbox-local'
import SandboxPolicy from '@lyness/lyn-sandbox-policy'
import SessionProjections from '@lyness/lyn-session-projection'
import type { SandboxMode } from '@lyness/lyn-sandbox'
import NodeRuntime from '../src/index.ts'
import type { Config } from '../src/index.ts'

export async function mountRuntime(ctx: Context, config: Config = {}, policy: { mode?: SandboxMode; workspaceRoot?: string } = {}) {
  onTestFinished(async () => { await ctx.fiber.dispose() })
  if (!ctx.get('sessions')) await ctx.plugin(SessionStore)
  if (!ctx.get('fs')) await ctx.plugin(FileSystem)
  if (!ctx.get('subprocess')) await ctx.plugin(Subprocess)
  if (!ctx.get('sandbox')) await ctx.plugin(Sandbox, {})
  if (!ctx.get('sessionProjections')) await ctx.plugin(SessionProjections)
  if (!ctx.get('sandboxPolicy')) await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  await ctx.plugin(NodeRuntime, config)
  return ctx.ptcRuntime as NodeRuntime
}
