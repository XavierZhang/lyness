/**
 * The studio refuses to write an SVG outside the brand grammar, even when the
 * tracer itself produced it.
 */

import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runStudio } from '../src/studio.ts'

vi.mock('@lyness/lyn-host-brand-icon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lyness/lyn-host-brand-icon')>()
  return {
    ...actual,
    vectorizeIcon: (png: Uint8Array) => ({ ...actual.vectorizeIcon(png), favicon: '<svg onload="alert(1)"></svg>' }),
  }
})

const require = createRequire(import.meta.url)
let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
})

it('refuses a generated SVG that is not a brand SVG and writes nothing', async () => {
  root = await mkdtemp(join(tmpdir(), 'brand-studio-'))
  const assetDirectory = join(root, 'brand')
  await expect(runStudio({
    productName: 'lyness',
    iconPath: join(import.meta.dirname, 'fixtures', 'icon.png'),
    fontPath: require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff2'),
    themeColor: undefined,
    assetDirectory,
    patchPath: join(root, 'cordis.patch.yml'),
  })).rejects.toThrow('brand-studio: the generated favicon is not a brand SVG')
  expect(existsSync(assetDirectory)).toBe(false)
})
