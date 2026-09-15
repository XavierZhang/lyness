/**
 * The shipped brand-studio profile launched the way an operator launches it:
 * `lyn --profile brand-studio` boots its bundle through the Loader, writes the
 * brand SVGs, and leaves a `brand-deployment` row in the web profile's layer.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveExampleLaunch } from '@lyness/lyn-loader-smoke'

const repoRoot = resolve(import.meta.dirname, '../../../../..')
const studioPackage = join(repoRoot, 'packages', 'bundle', 'brand-studio')
const font = createRequire(join(studioPackage, 'package.json')).resolve('@fontsource/inter/files/inter-latin-600-normal.woff2')
const icon = join(studioPackage, 'tests', 'fixtures', 'icon.png')

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function launch(args: readonly string[]) {
  root = await mkdtemp(join(tmpdir(), 'brand-studio-e2e-'))
  const home = join(root, '.lyn')
  const spawn = resolveExampleLaunch({
    srcBin: join(repoRoot, 'apps', 'cli', 'src', 'bin.ts'),
    configArgs: ['--profile', 'brand-studio', ...args],
    tsconfigPath: join(repoRoot, 'tsconfig.base.json'),
    sourceImport: 'tsx/esm',
    env: { LYNESS_HOME: home },
  })
  const result = await execa(spawn.command, spawn.args, {
    cwd: root,
    env: { ...process.env, ...spawn.env },
    timeout: 60_000,
    killSignal: 'SIGKILL',
    reject: false,
  })
  return { home, result }
}

describe('lyn --profile brand-studio', () => {
  it('writes the brand and the web profile row that serves it', async () => {
    const { home, result } = await launch(['--name', 'lyness', '--icon', icon, '--font', font, '--theme-color', 'teal', '--accept-trademark'])
    expect(result.stderr).not.toContain('brand-studio:')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('brand-studio: wrote the brand for "lyness"')

    for (const file of ['mark.svg', 'wordmark.svg', 'favicon.svg']) {
      expect(await readFile(join(home, 'brand', file), 'utf8')).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /u)
    }
    const layer = await readFile(join(home, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
    expect(layer).toContain('- id: brand-deployment')
    expect(layer).toContain(`assetDirectory: ${join(home, 'brand')}`)
    expect(layer).toContain('themeColor: teal')
  })

  it('refuses an invocation without the trademark confirmation and writes nothing', async () => {
    const { home, result } = await launch(['--name', 'lyness', '--icon', icon, '--font', font])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('pass --accept-trademark')
    await expect(readFile(join(home, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')).rejects.toThrow(/ENOENT/u)
  })
})
