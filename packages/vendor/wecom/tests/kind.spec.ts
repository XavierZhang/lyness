/**
 * WeCom offered as a configurable kind: what an administrator must fill in,
 * what the registry then offers, and what a missing required setting does.
 * Both required settings are checked, because either one alone is refused.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import ChannelKindRegistry from '@lyness/lyn-sign-in/kinds'
import type { ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import { channelId } from '@lyness/lyn-sign-in'
import { DISPLAY_NAME } from '../src/index.ts'
import * as Kind from '../src/kind.ts'
import { create, FIELDS, KIND } from '../src/kind.ts'

const REQUIRED = { corpId: 'ww-acme', agentId: '1000002' }

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
function instance(settings: Record<string, string> = REQUIRED): ConfiguredChannel {
  return { id: channelId('one'), displayName: 'Head office', settings, secret: 'application_secret' }
}

describe('wecom as a configurable kind', () => {
  it('offers itself to the registry with the settings one instance needs', async () => {
    const ctx = await bench()
    expect(ctx.signInKinds.available()).toEqual([{ id: KIND, displayName: DISPLAY_NAME, fields: FIELDS }])
  })

  it('builds a channel carrying the instance identity, and keeps the optional settings it is given', async () => {
    const ctx = await bench()
    const plain = create(instance(), ctx)
    expect(plain.id).toBe(channelId('one'))
    expect(plain.kind).toBe('redirect')
    const configured = create(instance({ ...REQUIRED, loginHost: 'login.wecom.example', apiOrigin: 'https://api.wecom.example' }), ctx)
    expect(configured.displayName).toBe('Head office')
  })

  it('refuses an instance missing either required setting', async () => {
    const ctx = await bench()
    const refused = 'wecom: a configured channel needs corpId and agentId'
    expect(() => create(instance({ agentId: REQUIRED.agentId }), ctx)).toThrow(refused)
    expect(() => create(instance({ corpId: REQUIRED.corpId }), ctx)).toThrow(refused)
    expect(() => create(instance({}), ctx)).toThrow(refused)
  })
})
