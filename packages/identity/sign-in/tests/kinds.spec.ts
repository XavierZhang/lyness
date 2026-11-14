/**
 * What the kind registry offers a configuration surface, and what it refuses:
 * two packages claiming one kind id.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ChannelKindRegistry, { chosen, identityOf, offering } from '../src/kinds.ts'
import type { ChannelKind } from '../src/kinds.ts'
import { channelId } from '../src/index.ts'

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** One kind that builds a channel out of whatever it is given. */
function kind(id: string, displayName = 'Fixture directory'): ChannelKind {
  return {
    id,
    displayName,
    fields: [{ name: 'corpId', label: 'corpid', required: true }],
    create: instance => ({
      kind: 'redirect',
      id: instance.id,
      displayName: instance.displayName,
      start: () => Promise.resolve({ to: 'https://directory.example', attempt: 'a' }),
      complete: () => Promise.resolve(undefined),
    }),
  }
}

/** A registry on its own context. */
async function bench(): Promise<Context> {
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(ChannelKindRegistry)
  return ctx
}

describe('the kinds a deployment can be configured with', () => {
  it('offers each one with the settings an instance needs', async () => {
    const ctx = await bench()
    ctx.signInKinds.register(kind('wecom', '企业微信'))
    expect(ctx.signInKinds.available()).toEqual([
      { id: 'wecom', displayName: '企业微信', fields: [{ name: 'corpId', label: 'corpid', required: true }] },
    ])
  })

  it('hands back the kind a configured instance names', async () => {
    const ctx = await bench()
    ctx.signInKinds.register(kind('wecom'))
    const found = ctx.signInKinds.get('wecom')
    expect(found?.id).toBe('wecom')
    expect(found?.create({
      id: channelId('one'),
      displayName: 'Acme',
      settings: { corpId: 'ww-acme' },
      secret: 'REF',
    }, ctx).displayName).toBe('Acme')
  })

  it('answers nothing for a kind no package offers', async () => {
    const ctx = await bench()
    expect(ctx.signInKinds.get('nowhere')).toBeUndefined()
    expect(ctx.signInKinds.available()).toEqual([])
  })

  it('refuses two packages claiming one kind id', async () => {
    const ctx = await bench()
    ctx.signInKinds.register(kind('wecom'))
    expect(() => ctx.signInKinds.register(kind('wecom'))).toThrow('already registered')
  })

  it('stops offering a kind whose plugin unloaded', async () => {
    const ctx = await bench()
    const fiber = await ctx.plugin({
      inject: ['signInKinds'],
      apply: (plugin: Context) => { plugin.effect(() => plugin.signInKinds.register(kind('wecom'))) },
    }).await()
    expect(ctx.signInKinds.available()).toHaveLength(1)
    await fiber.dispose()
    expect(ctx.signInKinds.available()).toEqual([])
  })
})

describe('what a kind package is spared writing itself', () => {
  it('carries an instance\'s own organization into the channel it builds', () => {
    expect(identityOf({ id: channelId('one'), displayName: 'Acme', settings: {}, secret: 'REF' }))
      .toEqual({ id: 'one', displayName: 'Acme' })
    expect(identityOf({
      id: channelId('one'),
      displayName: 'Acme',
      organization: 'acme',
      settings: {},
      secret: 'REF',
    })).toEqual({ id: 'one', displayName: 'Acme', organization: 'acme' })
  })

  it('passes on only the optional settings that were filled in', () => {
    expect(chosen({ apiOrigin: 'https://acme.example', loginHost: '' }, ['apiOrigin', 'loginHost', 'scope']))
      .toEqual({ apiOrigin: 'https://acme.example' })
  })

  it('offers one kind and takes it back with the plugin', async () => {
    const ctx = await bench()
    const fiber = await ctx.plugin({ inject: ['signInKinds'], apply: offering(kind('wecom')) }).await()
    expect(ctx.signInKinds.available()).toHaveLength(1)
    await fiber.dispose()
    expect(ctx.signInKinds.available()).toEqual([])
  })
})
