import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectBundledAssets } from './gen-third-party-notices.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/**
 * Write a repository fixture.
 * @param files - file contents by path relative to the fixture root.
 * @returns the fixture root.
 */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'bundled-assets-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

const FONT = 'packages/host/fonts/fonts/Brand.otf'

/**
 * One package holding a font file and the record of one asset.
 * @param record - fields replacing the valid font record's.
 * @returns the fixture files.
 */
function fontPackage(record: Record<string, unknown> = {}): Record<string, string> {
  return {
    'packages/host/fonts/package.json': '{}',
    [FONT]: 'font bytes',
    'packages/host/fonts/fonts/OFL.txt': 'license text',
    'packages/host/fonts/third-party-assets.json': JSON.stringify({
      assets: [{
        file: 'fonts/Brand.otf',
        name: 'Brand Sans',
        version: '1.0',
        license: 'OFL-1.1',
        licenseFile: 'fonts/OFL.txt',
        source: 'https://example.com/brand-sans',
        sha256: sha256('font bytes'),
        ...record,
      }],
    }),
  }
}

/**
 * Drop the font file from a fixture.
 * @param files - fixture files.
 * @returns the files without the font.
 */
function withoutFont(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([path]) => path !== FONT))
}

describe('collectBundledAssets', () => {
  it('records each file with its license text and source', () => {
    expect(collectBundledAssets(fixture(fontPackage()))).toEqual([{
      file: FONT,
      name: 'Brand Sans',
      version: '1.0',
      license: 'OFL-1.1',
      licenseFile: 'packages/host/fonts/fonts/OFL.txt',
      source: 'https://example.com/brand-sans',
    }])
  })

  it('accepts a permissive non-font file and ignores installed and built font files', () => {
    const files = {
      ...withoutFont(fontPackage({ file: 'data/table.json', license: 'MIT', sha256: sha256('{}') })),
      'packages/host/fonts/data/table.json': '{}',
      'packages/host/other/package.json': '{}',
      'packages/host/other/node_modules/dep/Dep.ttf': 'installed',
      'packages/host/other/lib/Built.woff2': 'built',
    }
    expect(collectBundledAssets(fixture(files)).map(asset => asset.file)).toEqual(['packages/host/fonts/data/table.json'])
  })

  it('refuses a file that no longer matches its checksum', () => {
    const files = { ...fontPackage(), [FONT]: 'edited bytes' }
    expect(() => collectBundledAssets(fixture(files))).toThrow(/does not match the SHA-256/u)
  })

  it('refuses a font file no record names', () => {
    expect(() => collectBundledAssets(fixture({ 'packages/host/fonts/package.json': '{}', [FONT]: 'font bytes' })))
      .toThrow(/Brand\.otf is not recorded/u)
    const two = { 'packages/host/fonts/package.json': '{}', 'packages/host/fonts/A.ttf': 'a', 'packages/host/fonts/B.woff': 'b' }
    expect(() => collectBundledAssets(fixture(two))).toThrow(/A\.ttf, packages\/host\/fonts\/B\.woff are not recorded/u)
  })

  it('refuses a license that is neither permissive nor an OFL font', () => {
    expect(() => collectBundledAssets(fixture(fontPackage({ license: 'GPL-3.0-only' })))).toThrow(/declares GPL-3\.0-only/u)
    const text = withoutFont(fontPackage({ file: 'fonts/OFL.txt', sha256: sha256('license text') }))
    expect(() => collectBundledAssets(fixture(text))).toThrow(/OFL\.txt declares OFL-1\.1/u)
  })

  it('refuses a malformed record', () => {
    expect(() => collectBundledAssets(fixture(fontPackage({ licenseFile: 'fonts/MISSING.txt' })))).toThrow(/MISSING\.txt, which does not exist/u)
    expect(() => collectBundledAssets(fixture(fontPackage({ sha256: 42 })))).toThrow(/without a string "sha256"/u)
    const notArray = { ...fontPackage(), 'packages/host/fonts/third-party-assets.json': '{"assets": {}}' }
    expect(() => collectBundledAssets(fixture(notArray))).toThrow(/must hold an "assets" array/u)
  })
})
