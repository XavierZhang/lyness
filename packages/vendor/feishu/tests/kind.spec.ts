/**
 * Feishu offered as a configurable kind: what an administrator must fill in,
 * what the registry then offers, and what a missing required setting does.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import ChannelKindRegistry from '@lyness/lyn-sign-in/kinds'
import type { ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import { channelId } from '@lyness/lyn-sign-in'
import { DISPLAY_NAME } from '../src/index.ts'
import * as Kind from '../src/kind.ts'
import { create, FIELDS, KIND } from '../src/kind.ts'

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A registry with this kind offered through its own plugin. */
async function bench(): Promise<Context> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(ChannelKindRegistry)
  await ctx.plugin(Kind).await()
  return ctx
}

/** One configured instance, with the required settings unless overridden. */
function instance(settings: Record<string, string> = { appId: 'cli-acme' }): ConfiguredChannel {
  return { id: channelId('one'), displayName: 'Head office', settings, secret: 'application_secret' }
}

describe('feishu as a configurable kind', () => {
  it('offers itself to the registry with the settings one instance needs', async () => {
    const ctx = await bench()
    expect(ctx.signInKinds.available()).toEqual([{ id: KIND, displayName: DISPLAY_NAME, fields: FIELDS }])
    expect(ctx.signInKinds.get(KIND)?.displayName).toBe(DISPLAY_NAME)
  })

  it('stops offering itself once its plugin unloads', async () => {
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin(ChannelKindRegistry)
    const fiber = await ctx.plugin(Kind).await()
    await fiber.dispose()
    expect(ctx.signInKinds.available()).toEqual([])
  })

  it('builds a channel carrying the instance identity, and keeps the optional settings it is given', async () => {
    const ctx = await bench()
    const plain = create(instance(), ctx)
    expect(plain.id).toBe(channelId('one'))
    expect(plain.displayName).toBe('Head office')
    expect(plain.kind).toBe('redirect')
    const configured = create(instance({ appId: 'cli-acme', apiOrigin: 'https://open.feishu.example' }), ctx)
    expect(configured.displayName).toBe('Head office')
  })

  it('refuses an instance without appId', async () => {
    const ctx = await bench()
    expect(() => create(instance({}), ctx)).toThrow('feishu: a configured channel needs appId')
  })
})
