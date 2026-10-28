/** The shipped patch leaves shared entries available while skipping an absent native provider. */
import { readFile } from 'node:fs/promises'
import { Context } from '@lyness/cordis'
import Loader, { interpolate, type EntryOptions } from '@lyness/cordis-plugin-loader'
import { entryListSchema } from '@lyness/cordis-plugin-include'
import { load } from 'js-yaml'
import { expect, it, vi } from 'vitest'

it.each(['darwin', 'win32', 'linux'])('loads the native provider only on Darwin for %s', async (platform) => {
  const patch = load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), {
    schema: entryListSchema,
  }) as { insert: EntryOptions[] }[]
  const ctx = new Context()
  await ctx.plugin(Loader)
  if (!ctx.loader.internal) throw new Error('Loader module importer is unavailable')
  const imported = vi.spyOn(ctx.loader.internal, 'import').mockImplementation(async (name: string) => {
    if (platform !== 'darwin' && name === '@lyness/lyn-experimental-cua-macos') {
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
    expect(imports.includes('@lyness/lyn-experimental-cua-macos')).toBe(platform === 'darwin')
  } finally {
    await ctx.fiber.dispose()
    imported.mockRestore()
  }
})
