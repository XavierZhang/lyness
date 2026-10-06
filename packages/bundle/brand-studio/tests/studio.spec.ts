/**
 * Coverage over what an operator's run leaves on disk: the traced SVGs, the
 * patch layer the brand row lands in, and each refusal an input can cause.
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { isBrandSvg } from '@lyness/lyn-host-brand-icon'
import { ASSET_FILES, BRAND_PACKAGE, resolveProfilePatch, runStudio, StudioError, upsertBrandRow } from '../src/studio.ts'
import type { StudioRequest } from '../src/studio.ts'

const require = createRequire(import.meta.url)
const FONT = require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff2')
const ICON = join(import.meta.dirname, 'fixtures', 'icon.png')

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (dir) => { await rm(dir, { recursive: true, force: true }) }))
})

async function scratch(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'brand-studio-'))
  directories.push(dir)
  return dir
}

async function request(overrides: Partial<StudioRequest> = {}): Promise<StudioRequest> {
  const root = await scratch()
  return {
    productName: 'lyness',
    productAbbreviation: undefined,
    productNameZh: undefined,
    colors: {},
    iconPath: ICON,
    fontPath: FONT,
    themeColor: '#1a73e8',
    assetDirectory: join(root, 'brand'),
    patchPath: join(root, 'cordis.patch.yml'),
    ...overrides,
  }
}

const FIELDS = { productName: 'Acme', assetDirectory: '/srv/brand' }

describe('upsertBrandRow', () => {
  it('adds a block-style row to a missing or template layer', () => {
    expect(upsertBrandRow('', FIELDS)).toBe([
      '- id: brand-deployment',
      `  name: "${BRAND_PACKAGE}"`,
      '  config:',
      '    productName: Acme',
      '    assetDirectory: /srv/brand',
      '',
    ].join('\n'))
    const template = upsertBrandRow('# Your patch layer\n[]\n', FIELDS)
    expect(template.startsWith('# Your patch layer\n- id: brand-deployment\n')).toBe(true)
  })

  it('updates every brand row in place and keeps what the studio does not own', () => {
    const layer = [
      '# operator notes',
      '- id: system-prompt',
      '  config:',
      '    personaPrefix: !!js process.env.PERSONA # evaluated by the Loader',
      '- id: brand-deployment',
      '  config:',
      '    productName: Old',
      '    showPoweredBy: true',
      '- id: brand-deployment',
      '  config: null',
      '',
    ].join('\n')
    const next = upsertBrandRow(layer, FIELDS)
    expect(next).toContain('# operator notes')
    expect(next).toContain('personaPrefix: !!js process.env.PERSONA # evaluated by the Loader')
    const rows = parse(next.replace('!!js ', '')) as { id: string; name?: string; config?: Record<string, unknown> }[]
    expect(rows[1]).toEqual({
      id: 'brand-deployment',
      name: BRAND_PACKAGE,
      config: { productName: 'Acme', showPoweredBy: true, assetDirectory: '/srv/brand' },
    })
    expect(rows[2]?.config).toEqual(FIELDS)
  })

  it('refuses a layer that is not a YAML array of rows', () => {
    expect(() => upsertBrandRow('id: brand-deployment\n', FIELDS)).toThrow(StudioError)
    expect(() => upsertBrandRow('- [unclosed\n', FIELDS)).toThrow(/not valid YAML/u)
  })
})

describe('resolveProfilePatch', () => {
  it('initializes a shipped profile that has never launched', async () => {
    const home = await scratch()
    const patch = resolveProfilePatch('web', home)
    expect(patch).toBe(join(home, 'profiles', 'web', 'cordis.patch.yml'))
    const manifest = JSON.parse(readFileSync(join(home, 'profiles', 'web', 'package.json'), 'utf8')) as { lyn: unknown }
    expect(manifest.lyn).toEqual({ profile: { bundles: ['@lyness/lyn-base', '@lyness/lyn-web-app'] } })
  })

  it('uses an existing custom profile and refuses one that does not exist', async () => {
    const home = await scratch()
    await mkdir(join(home, 'profiles', 'tenant'), { recursive: true })
    await writeFile(join(home, 'profiles', 'tenant', 'package.json'), '{}\n')
    expect(resolveProfilePatch('tenant', home)).toBe(join(home, 'profiles', 'tenant', 'cordis.patch.yml'))
    expect(() => resolveProfilePatch('missing', home)).toThrow(/profile "missing" does not exist/u)
    expect(existsSync(join(home, 'profiles', 'missing'))).toBe(false)
  })
})

describe('runStudio', () => {
  it('writes three brand SVGs and a brand row that names them', async () => {
    const subject = await request()
    const result = await runStudio(subject)

    for (const role of ['mark', 'wordmark', 'favicon'] as const) {
      expect(result.assets[role]).toBe(join(subject.assetDirectory, ASSET_FILES[role]))
      expect(isBrandSvg(await readFile(result.assets[role], 'utf8'))).toBe(true)
    }
    expect(result.iconAspect).toBeGreaterThanOrEqual(1)
    expect(result.wordmarkAspect).toBeGreaterThan(1)
    expect(parse(await readFile(subject.patchPath, 'utf8'))).toEqual([{
      id: 'brand-deployment',
      name: BRAND_PACKAGE,
      config: {
        productName: 'lyness',
        themeColor: '#1a73e8',
        assetDirectory: subject.assetDirectory,
        mark: 'mark.svg',
        wordmark: 'wordmark.svg',
        favicon: 'favicon.svg',
      },
    }])
  })

  it('writes every name the brand carries and the palette tokens it replaces', async () => {
    const subject = await request({
      productName: 'Acme Agent',
      productAbbreviation: 'ACME',
      productNameZh: '艾可',
      colors: { blue: '#1a73e8', gray50: 'white' },
    })
    await runStudio(subject)
    expect(parse(await readFile(subject.patchPath, 'utf8'))).toEqual([{
      id: 'brand-deployment',
      name: BRAND_PACKAGE,
      config: {
        productName: 'Acme Agent',
        productAbbreviation: 'ACME',
        productNameZh: '艾可',
        themeColor: '#1a73e8',
        assetDirectory: subject.assetDirectory,
        colors: { blue: '#1a73e8', gray50: 'white' },
        mark: 'mark.svg',
        wordmark: 'wordmark.svg',
        favicon: 'favicon.svg',
      },
    }])
  })

  it('keeps a palette token the run does not name', async () => {
    const subject = await request({ colors: { blue: '#1a73e8' } })
    await writeFile(subject.patchPath, '- id: brand-deployment\n  config:\n    colors:\n      error: crimson\n')
    await runStudio(subject)
    const [row] = parse(await readFile(subject.patchPath, 'utf8')) as { config: { colors: Record<string, string> } }[]
    expect(row?.config.colors).toEqual({ error: 'crimson', blue: '#1a73e8' })
  })

  it('refuses a name or a palette token the deployment could not use', async () => {
    const brace = await request({ productAbbreviation: 'A{B}' })
    await expect(runStudio(brace)).rejects.toThrow(/productAbbreviation must be one line/u)

    const prose = await request({ productNameZh: '艾'.repeat(65) })
    await expect(runStudio(prose)).rejects.toThrow(/productNameZh must be one line/u)

    const unknown = await request({ colors: { accent: '#1a73e8' } })
    await expect(runStudio(unknown)).rejects.toThrow(/there is no palette token "accent"/u)

    const unusable = await request({ colors: { blue: 'rgb(1, 2, 3)' } })
    await expect(runStudio(unusable)).rejects.toThrow(/blue must be a hex colour or a colour keyword/u)

    for (const subject of [brace, prose, unknown, unusable]) {
      expect(existsSync(subject.assetDirectory)).toBe(false)
    }
  })

  it('sets a name in the built-in fonts when the brand supplies none', async () => {
    const subject = await request({ productName: '领驭 lyness', fontPath: undefined })
    const result = await runStudio(subject)
    expect(isBrandSvg(await readFile(result.assets.wordmark, 'utf8'))).toBe(true)
  })

  it('keeps the colour a row already names when the run supplies none', async () => {
    const subject = await request({ themeColor: undefined })
    await writeFile(subject.patchPath, '- id: brand-deployment\n  config:\n    themeColor: teal\n')
    await runStudio(subject)
    expect(await readFile(subject.patchPath, 'utf8')).toContain('themeColor: teal')
  })

  it('writes nothing when a colour, an input file, or the patch layer is unusable', async () => {
    const colour = await request({ themeColor: 'rgb(1, 2, 3)' })
    await expect(runStudio(colour)).rejects.toThrow(/theme colour must be a hex colour or a colour keyword/u)

    const icon = await request({ iconPath: join(tmpdir(), 'brand-studio-no-such-icon.png') })
    await expect(runStudio(icon)).rejects.toThrow(/ENOENT/u)

    const layer = await request()
    await mkdir(layer.patchPath)
    await expect(runStudio(layer)).rejects.toThrow(/EISDIR/u)

    for (const subject of [colour, icon, layer]) expect(existsSync(subject.assetDirectory)).toBe(false)
  })
})
