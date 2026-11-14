/**
 * An OpenID Provider offered as a configurable kind: what an administrator
 * must fill in, what the registry then offers, and what a missing required
 * setting does.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ChannelKindRegistry from '@deepseek-ai/dsh-sign-in/kinds'
import type { ConfiguredChannel } from '@deepseek-ai/dsh-sign-in/kinds'
import { channelId } from '@deepseek-ai/dsh-sign-in'
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
  ctx.provide('credentials', { resolve: () => Promise.resolve({ value: 'the-secret' }) })
  return ctx
}

/** One configured instance, with the required settings unless overridden. */
function instance(settings: Record<string, string> = { issuer: 'https://idp.example', clientId: 'deepseek-harness-web' }): ConfiguredChannel {
  return { id: channelId('one'), displayName: 'Acme SSO', settings, secret: 'client_secret' }
}

describe('an OpenID Provider as a configurable kind', () => {
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
    expect(plain.displayName).toBe('Acme SSO')
    expect(plain.kind).toBe('redirect')
    const configured = create(instance({
      issuer: 'https://idp.example',
      clientId: 'deepseek-harness-web',
      scope: 'openid email',
      organization: 'acme',
      organizationClaim: 'org.id',
      organizationParameter: 'organization_id',
    }), ctx)
    expect(configured.organization).toBe('acme')
  })

  it.each([
    ['issuer', { clientId: 'deepseek-harness-web' }],
    ['clientId', { issuer: 'https://idp.example' }],
  ])('refuses an instance without %s', async (_case, settings) => {
    const ctx = await bench()
    expect(() => create(instance(settings), ctx)).toThrow('oidc: a configured channel needs issuer and clientId')
  })
})
