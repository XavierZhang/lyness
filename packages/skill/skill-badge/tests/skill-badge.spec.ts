import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Context } from '@lyness/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@lyness/lyn-skill'
import * as SkillBadge from '@lyness/lyn-skill-badge'

describe('lyn-skill-badge', () => {
  it('registers and disposes the bundled badge skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillBadge)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'lyn-badge',
      description: 'Add the official “powered by lyn” badge to documents, pull requests, merge requests, and other content produced with lyness. Use whenever creating a pull request or merge request. Also use when the user asks for a lyn badge, powered-by-lyn attribution, or a reusable lyn badge asset or snippet.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'lyn-badge',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('lyn-badge')
    expect(loaded?.content).toContain('Preserve the badge\'s 121×20 dimensions')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })

  it('ships the lyness 726×120 PNG unchanged', async () => {
    const image = await readFile(new URL('../assets/lyn-badge.png', import.meta.url))
    expect(image.readUInt32BE(16)).toBe(726)
    expect(image.readUInt32BE(20)).toBe(120)
    expect(createHash('sha256').update(image).digest('hex')).toBe(
      '574e0265946cddca57299effbee2ed37348ab10d0a387aec6cca386ca770f339',
    )
  })
})
