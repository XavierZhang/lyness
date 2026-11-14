/**
 * What a reader is told about a tool when the deployment composed it from a
 * package: the plugin's own title, in the reader's language, rather than the
 * model-facing name the registry holds.
 *
 * A real Loader and a real package on disk, because the whole answer is the
 * join between three services — the registry knows the Fiber, the Loader
 * knows which entry mounted it, and the package service reads that package's
 * own files — and a double for any of them would prove only that this spec
 * agrees with itself.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import { PluginPackages } from '@lyness/lyn-app-boot'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import AgentCapabilitiesController from '../src/index.ts'

const contexts: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A package on disk whose plugin registers two tools and declares its own title. */
function packageFixture(): { baseUrl: string } {
  const root = mkdtempSync(join(tmpdir(), 'lyn-capabilities-'))
  roots.push(root)
  const dir = join(root, 'node_modules', 'local-plugin')
  mkdirSync(join(dir, 'locale'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'local-plugin',
    type: 'module',
    exports: { './feature': './index.js', './feature/locale/*.json': './locale/*.json' },
  }))
  writeFileSync(join(dir, 'index.js'), `
export const name = 'local-tools'
export const inject = ['tools']
const output = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }
export function apply(ctx) {
  for (const tool of ['peek', 'poke']) {
    ctx.tools.register({
      name: tool, description: 'Model-facing prose about arguments and exit codes.',
      parameters: {}, output, execute: () => Promise.resolve('ok'),
    })
  }
}
`)
  writeFileSync(join(dir, 'locale', 'en.json'), '{"meta":{"title":"Local tools","description":"Reads and writes the things."}}')
  writeFileSync(join(dir, 'locale', 'zh.json'), '{"meta":{"title":"本地工具"}}')
  return { baseUrl: pathToFileURL(join(root, 'entry.mjs')).href }
}

describe('what the composed deployment answers', () => {
  it('names the plugin a tool came from, with that package\'s own title', async () => {
    const { baseUrl } = packageFixture()
    const ctx = new Context()
    contexts.push(ctx)
    ctx.baseUrl = baseUrl
    await ctx.plugin(Loader)
    await ctx.plugin(PluginPackages, {})
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(ToolRuntime, {}).await()
    await ctx.plugin(AgentCapabilitiesController)
    const id = await ctx.loader.create({ name: 'local-plugin/feature' })
    await ctx.loader.resolve(id)?.fiber?.await()

    const view = await ctx.agentCapabilitiesController.describe()
    // One row for the package, both tool names on it, and the title its
    // author wrote in both languages — the client picks the reader's.
    expect(view.tools).toEqual([{
      plugin: 'local-tools',
      tools: ['peek', 'poke'],
      source: 'deployment',
      meta: {
        title: { en: 'Local tools', zh: '本地工具' },
        description: { en: 'Reads and writes the things.' },
      },
    }])
    // The model-facing description never crosses the wire to this page.
    expect(JSON.stringify(view.tools)).not.toContain('exit codes')
  })
})
