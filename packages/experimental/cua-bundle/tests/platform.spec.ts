/** Explicit patch overlays bypass bundle admission and must not import an absent native provider. */
import { readFile } from 'node:fs/promises'
import { Context } from '@lyness/cordis'
import Loader, { interpolate, type EntryOptions } from '@lyness/cordis-plugin-loader'
import { parseEntryYaml } from '@lyness/cordis-plugin-include'
import { expect, it, vi } from 'vitest'

it.each(['darwin', 'win32', 'linux'])('loads the exported patch directly on %s and selects its native provider', async (platform) => {
  const patch = parseEntryYaml(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')) as { insert: EntryOptions[] }[]
  for (const id of ['cua-macos', 'cua-windows']) {
    expect(patch[0]!.insert.find(row => row.id === id)?.name).toBe(`@lyness/lyn-${id}`)
  }
  const ctx = new Context()
  await ctx.plugin(Loader)
  if (!ctx.loader.internal) throw new Error('Loader module importer is unavailable')
  const imported = vi.spyOn(ctx.loader.internal, 'import').mockImplementation(async (name: string) => {
    if (platform !== 'darwin' && name === '@lyness/lyn-cua-macos') {
      throw new Error('native provider is absent from this installation')
    }
    return { name, apply: () => {} }
  })
  try {
    for (const row of patch[0]!.insert) {
      await ctx.loader.create({ ...row, disabled: Boolean(interpolate({ process: { platform } }, row.disabled)) })
    }
    await ctx.loader.await()
    const imports = imported.mock.calls.map(call => call[0])
    expect(imports).toContain('@lyness/lyn-cua')
    expect(imports).toContain('@lyness/lyn-computer-use')
    expect(imports.includes('@lyness/lyn-cua-macos')).toBe(platform === 'darwin')
    expect(imports.includes('@lyness/lyn-cua-windows')).toBe(platform === 'win32')
  } finally {
    await ctx.fiber.dispose()
    imported.mockRestore()
  }
})
