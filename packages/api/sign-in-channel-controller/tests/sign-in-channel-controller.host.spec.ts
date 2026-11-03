/**
 * What the configuration surface answers an administrator, and what it
 * refuses: another organization's channel, a kind nothing offers, a new
 * channel without its secret, and a call that established no standing.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Membership, MembershipId, PersonId, Role } from '@deepseek-ai/dsh-people'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import SignIn from '@deepseek-ai/dsh-sign-in'
import ChannelKindRegistry from '@deepseek-ai/dsh-sign-in/kinds'
import type { ChannelKind, ConfiguredChannel } from '@deepseek-ai/dsh-sign-in/kinds'
import type { SignInChannel } from '@deepseek-ai/dsh-sign-in'
import AdminAudit from '@deepseek-ai/dsh-admin-audit'
import ConfiguredChannels from '@deepseek-ai/dsh-sign-in-channels'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import SignInChannelController from '../src/index.ts'
import type { ChannelInput } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** One standing, as the directory reports it. */
function standing(role: Role, organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`ada:${role}`),
    person: ADA,
    role,
    ...organization === undefined ? {} : { organization },
  }
}

/** A kind that builds a channel out of whatever it is given. */
const fixtureKind: ChannelKind = {
  id: 'fixture',
  displayName: 'Fixture directory',
  fields: [{ name: 'corpId', label: 'corpid', required: true }],
  create: (instance: ConfiguredChannel): SignInChannel => ({
    kind: 'redirect',
    id: instance.id,
    displayName: instance.displayName,
    ...instance.organization === undefined ? {} : { organization: instance.organization },
    start: () => Promise.resolve({ to: 'https://directory.example', attempt: 'a' }),
    complete: () => Promise.resolve(undefined),
  }),
}

/** What one harness mounts, beside the standing that calls it. */
interface Mounted {
  /** Whether this deployment stores configured channels at all. */
  readonly channels?: boolean
  /** What the credential store throws instead of keeping a secret. */
  readonly secretStoreFails?: string
}

/** The deployment, with one standing calling it. */
async function harness(by: Membership | 'none', mounted: Mounted = {}): Promise<SignInChannelController> {
  root ??= await mkdtemp(join(tmpdir(), 'dsh-sign-in-channel-controller-'))
  const ctx = new Context()
  live.push(ctx)
  const secrets = new Map<string, string>()
  ctx.provide('requestPrincipal', {
    current: () => by === 'none' ? undefined : { person: by.person, acting: { person: by.person, membership: by.id } },
  })
  ctx.provide('people', {
    person: () => Promise.resolve(by === 'none' ? undefined : { id: by.person, displayName: 'Ada' }),
    membership: (id: MembershipId) => Promise.resolve(by !== 'none' && id === by.id ? by : undefined),
    memberships: () => Promise.resolve([]),
  })
  if (mounted.channels !== false) {
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root: join(root, 'state') })
    await ctx.plugin(StorageDomain, { backend: 'json' })
    ctx.provide('signInAdmission', { admit: () => Promise.resolve(undefined) })
    ctx.provide('authSessions', { establish: () => Promise.resolve({ id: 's' }) })
    await ctx.plugin(SignIn)
    await ctx.plugin(ChannelKindRegistry)
    ctx.signInKinds.register(fixtureKind)
    ctx.provide('credentials', {
      set: (ref: string, value: string) => {
        if (mounted.secretStoreFails !== undefined) return Promise.reject(new Error(mounted.secretStoreFails))
        secrets.set(ref, value)
        return Promise.resolve()
      },
      unset: (ref: string) => { secrets.delete(ref); return Promise.resolve() },
      resolve: (ref: string) => Promise.resolve(secrets.has(ref) ? { value: secrets.get(ref) } : undefined),
    })
    await ctx.plugin(AdminAudit, {}).await()
    await ctx.plugin(ConfiguredChannels)
    await Promise.resolve()
  }
  await ctx.plugin(SignInChannelController)
  return ctx.signInChannelController
}

/** One ordinary submission for the fixture kind. */
function input(over: Partial<ChannelInput> = {}): ChannelInput {
  return {
    kind: 'fixture',
    displayName: 'Acme directory',
    settings: { corpId: 'ww-acme' },
    secret: 'the-secret',
    ...over,
  }
}

/** The failure code one call answered with. */
async function codeOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call
    return undefined
  } catch (failed: unknown) {
    return failed instanceof RemoteError ? String(failed.code) : undefined
  }
}

describe('a tenant administrator', () => {
  it('is offered the kinds this deployment mounts, with the settings each needs', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    expect(controller.kinds()).toEqual([
      {
        id: 'fixture',
        displayName: 'Fixture directory',
        fields: [{ name: 'corpId', label: 'corpid', required: true }],
      },
    ])
  })

  it('configures a channel for its own organization, and reads it back serving', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    const saved = await controller.save(input({ organization: 'acme' }))
    expect(saved).toMatchObject({
      kind: 'fixture',
      displayName: 'Acme directory',
      organization: 'acme',
      configuredBy: 'ada',
      mounted: true,
    })
    expect(await controller.list()).toEqual([saved])
    // The secret went in and does not come back: what is stored is the
    // reference the credential store keeps it under, and that never crosses.
    expect(JSON.stringify(saved)).not.toContain('the-secret')
  })

  it('is refused the deployment\'s own channels', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    expect(await codeOf(controller.save(input()))).toBe('sign-in-channels/not-permitted')
  })

  it('removes a channel it configured', async () => {
    const controller = await harness(standing('tenant-administrator', 'acme'))
    const saved = await controller.save(input({ organization: 'acme' }))
    await controller.remove(saved.id)
    expect(await controller.list()).toEqual([])
  })

  it('is refused another organization\'s channel, by id', async () => {
    const platform = await harness(standing('platform-administrator'))
    const other = await platform.save(input({ organization: 'other' }))
    const controller = await harness(standing('tenant-administrator', 'acme'))
    // Both deployments read the same store, so naming the id is all this
    // caller could do; what refuses it is the organization on the record.
    expect(await codeOf(controller.remove(other.id))).toBe('sign-in-channels/not-permitted')
    expect(await platform.list()).toHaveLength(1)
  })
})

describe('what a submission is refused for', () => {
  it('names the kind nothing offers', async () => {
    const controller = await harness(standing('platform-administrator'))
    expect(await codeOf(controller.save(input({ kind: 'nowhere' })))).toBe('sign-in-channels/unknown-kind')
  })

  it('names every setting that was left empty', async () => {
    const controller = await harness(standing('platform-administrator'))
    try {
      await controller.save(input({ settings: { corpId: '' } }))
      expect.unreachable('an incomplete submission is refused')
    } catch (failed: unknown) {
      expect(failed).toBeInstanceOf(RemoteError)
      expect((failed as RemoteError).code).toBe('sign-in-channels/incomplete')
      expect((failed as RemoteError).details).toEqual({ fields: ['corpId'] })
    }
  })

  it('refuses a new channel that carries no secret', async () => {
    const controller = await harness(standing('platform-administrator'))
    const { secret: _secret, ...without } = input()
    expect(await codeOf(controller.save(without))).toBe('sign-in-channels/incomplete')
  })

  it('reports a store that could not keep the secret as itself, not as a refusal', async () => {
    const controller = await harness(standing('platform-administrator'), { secretStoreFails: 'the vault is sealed' })
    // Not every failure is a decision about this submission: resending it
    // changes nothing, and reporting it as one would send an administrator to
    // correct a field that is already right.
    await expect(controller.save(input())).rejects.toThrow('the vault is sealed')
  })

  it('leaves the stored secret alone when a replacement omits one', async () => {
    const controller = await harness(standing('platform-administrator'))
    const saved = await controller.save(input())
    const renamed = await controller.save({ id: saved.id, kind: 'fixture', displayName: 'Renamed', settings: { corpId: 'ww-acme' } })
    expect(renamed).toMatchObject({ id: saved.id, displayName: 'Renamed', mounted: true })
  })
})

describe('a call with nothing behind it', () => {
  it('is refused rather than acted on for nobody', async () => {
    const controller = await harness('none')
    expect(await codeOf(controller.list())).toBe('sign-in-channels/no-standing')
  })

  it('reports a deployment that stores no configured channels', async () => {
    const controller = await harness(standing('platform-administrator'), { channels: false })
    expect(await codeOf(controller.list())).toBe('gateway/internal')
    expect(controller.kinds()).toEqual([])
  })
})
