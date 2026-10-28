/**
 * What an administrator may configure, what mounts from it, and what each
 * refusal protects: one tenant claiming another's channel, a kind nothing
 * offers, a new channel without its secret, and a setting its kind requires.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import SignIn from '@lyness/lyn-sign-in'
import ChannelKindRegistry from '@lyness/lyn-sign-in/kinds'
import type { ChannelKind, ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import type { SignInChannel } from '@lyness/lyn-sign-in'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, MembershipId, PersonId, Role } from '@lyness/lyn-people'
import AdminAudit from '@lyness/lyn-admin-audit'
import ConfiguredChannels, { KIND_UNKNOWN, NOT_PERMITTED, SECRET_REQUIRED, secretRefOf } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined
let refused: string | undefined
let stored: Map<string, string>

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

beforeEach(() => {
  refused = undefined
  stored = new Map()
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

/** A kind that builds a channel out of whatever it is given, unless the test refuses. */
function fixtureKind(id = 'fixture'): ChannelKind {
  return {
    id,
    displayName: 'Fixture directory',
    fields: [{ name: 'corpId', label: 'corpid', required: true }],
    create: (instance: ConfiguredChannel): SignInChannel => {
      if (refused !== undefined) throw new Error(refused)
      return {
        kind: 'redirect',
        id: instance.id,
        displayName: instance.displayName,
        ...instance.organization === undefined ? {} : { organization: instance.organization },
        start: () => Promise.resolve({ to: 'https://directory.example', attempt: 'a' }),
        complete: () => Promise.resolve(undefined),
      }
    },
  }
}

/** Boot storage, the registries, and the service over a fresh root. */
async function bench(kinds: readonly ChannelKind[] = [fixtureKind()]): Promise<Context> {
  root ??= await mkdtemp(join(tmpdir(), 'lyn-sign-in-channels-'))
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'state') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  ctx.provide('signInAdmission', { admit: () => Promise.resolve(undefined) })
  ctx.provide('authSessions', { establish: () => Promise.resolve({ id: 's' }) })
  await ctx.plugin(SignIn)
  await ctx.plugin(ChannelKindRegistry)
  for (const kind of kinds) ctx.signInKinds.register(kind)
  ctx.provide('credentials', {
    set: (ref: string, value: string) => { stored.set(ref, value); return Promise.resolve() },
    unset: (ref: string) => { stored.delete(ref); return Promise.resolve() },
    resolve: (ref: string) => Promise.resolve(stored.has(ref) ? { value: stored.get(ref) } : undefined),
  })
  await ctx.plugin(AdminAudit, {}).await()
  await ctx.plugin(ConfiguredChannels)
  // The service mounts what it stored as soon as its domain opens.
  await Promise.resolve()
  return ctx
}

/** One ordinary submission for the fixture kind. */
function submission(over: Partial<Parameters<ConfiguredChannels['save']>[0]> = {}) {
  return {
    kind: 'fixture',
    displayName: 'Acme directory',
    settings: { corpId: 'ww-acme' },
    secret: 'the-secret',
    ...over,
  }
}

describe('configuring one channel', () => {
  it('mounts it, and offers it on the sign-in page it belongs to', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission({ organization: 'acme' }), standing('tenant-administrator', 'acme'))
    expect(saved).toMatchObject({ kind: 'fixture', displayName: 'Acme directory', organization: 'acme', mounted: true })
    expect(ctx.signIn.available({ organization: 'acme' }).map(one => one.id)).toEqual([saved.id])
  })

  it('keeps one organization’s channel off another’s sign-in page', async () => {
    const ctx = await bench()
    await ctx.signInChannels.save(submission({ organization: 'acme' }), standing('tenant-administrator', 'acme'))
    expect(ctx.signIn.available({ organization: 'zenith' })).toEqual([])
    expect(ctx.signIn.available()).toEqual([])
  })

  it('offers a deployment-wide channel to everyone', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    expect(ctx.signIn.available().map(one => one.id)).toEqual([saved.id])
    expect(ctx.signIn.available({ organization: 'acme' }).map(one => one.id)).toEqual([saved.id])
  })

  it('stores the secret under a reference derived from the channel’s own id', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    expect(stored.get(secretRefOf(saved.id))).toBe('the-secret')
  })

  it('never shows the secret back', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    expect(JSON.stringify(saved)).not.toContain('the-secret')
  })
})

describe('replacing one channel', () => {
  it('keeps its id, so the bindings written against it still match', async () => {
    const ctx = await bench()
    const first = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    const again = await ctx.signInChannels.save(
      { ...submission(), id: first.id, displayName: 'Renamed' },
      standing('platform-administrator'),
    )
    expect(again.id).toBe(first.id)
    expect(again.displayName).toBe('Renamed')
    expect(ctx.signIn.available()).toHaveLength(1)
  })

  it('leaves the stored secret alone when the administrator sent none', async () => {
    const ctx = await bench()
    const first = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    await ctx.signInChannels.save(
      { kind: 'fixture', displayName: 'Renamed', settings: { corpId: 'ww-acme' }, id: first.id },
      standing('platform-administrator'),
    )
    expect(stored.get(secretRefOf(first.id))).toBe('the-secret')
  })

  it('refuses one tenant claiming another’s channel by naming its id', async () => {
    const ctx = await bench()
    const theirs = await ctx.signInChannels.save(
      submission({ organization: 'acme' }),
      standing('tenant-administrator', 'acme'),
    )
    await expect(ctx.signInChannels.save(
      { ...submission(), id: theirs.id, organization: 'zenith' },
      standing('tenant-administrator', 'zenith'),
    )).rejects.toThrow(NOT_PERMITTED)
  })
})

describe('what the trail records', () => {
  it('names each setting that changed, and never the secret itself', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const added = await ctx.signInChannels.save(submission({ organization: 'acme' }), by)
    await ctx.signInChannels.save(
      submission({ id: added.id, organization: 'acme', settings: { corpId: 'ww-other' }, secret: 'rotated' }),
      by,
    )

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, by)
    expect(trail.map(entry => [entry.kind, entry.action])).toEqual([
      ['sign-in-channel', 'changed'], ['sign-in-channel', 'added'],
    ])
    // The setting reads by its own name, and the rotation is recorded with
    // neither side: the trail must not be where a directory's secret is
    // readable from.
    expect(trail[0]?.changes).toEqual([
      { field: 'settings.corpId', before: 'ww-acme', after: 'ww-other' },
      { field: 'secret', redacted: true },
    ])
    expect(JSON.stringify(trail)).not.toContain('rotated')
    expect(JSON.stringify(trail)).not.toContain('the-secret')
  })

  it('records a rotation that changed nothing else', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const added = await ctx.signInChannels.save(submission({ organization: 'acme' }), by)
    await ctx.signInChannels.save(submission({ id: added.id, organization: 'acme', secret: 'rotated' }), by)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, by)
    expect(trail[0]?.changes).toEqual([{ field: 'secret', redacted: true }])
  })

  it('records nothing for a save that altered no setting and rotated nothing', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const added = await ctx.signInChannels.save(submission({ organization: 'acme' }), by)
    const { secret: _kept, ...unchanged } = submission({ id: added.id, organization: 'acme' })
    await ctx.signInChannels.save(unchanged, by)

    expect((await ctx.adminAudit.read({ organization: 'acme' }, by)).map(entry => entry.action))
      .toEqual(['added'])
  })

  it('records a removal as the settings going and the secret with them', async () => {
    const ctx = await bench()
    const by = standing('tenant-administrator', 'acme')
    const added = await ctx.signInChannels.save(submission({ organization: 'acme' }), by)
    await ctx.signInChannels.remove(added.id, by)

    const trail = await ctx.adminAudit.read({ organization: 'acme' }, by)
    expect(trail[0]).toMatchObject({ action: 'removed', subjectName: 'Acme directory' })
    expect(trail[0]?.changes).toEqual([
      { field: 'kind', before: 'fixture' },
      { field: 'displayName', before: 'Acme directory' },
      { field: 'organization', before: 'acme' },
      { field: 'settings.corpId', before: 'ww-acme' },
      { field: 'secret', redacted: true },
    ])
  })
})

describe('what it refuses', () => {
  it('refuses a tenant administrator configuring the deployment’s own channels', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(submission(), standing('tenant-administrator', 'acme')))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a tenant administrator configuring another organization’s', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(submission({ organization: 'zenith' }), standing('tenant-administrator', 'acme')))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a member configuring anything', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(submission({ organization: 'acme' }), standing('member', 'acme')))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('refuses a kind nothing offers', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(submission({ kind: 'nowhere' }), standing('platform-administrator')))
      .rejects.toThrow(KIND_UNKNOWN)
  })

  it('refuses a new channel without its secret', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(
      { kind: 'fixture', displayName: 'Acme', settings: { corpId: 'ww-acme' } },
      standing('platform-administrator'),
    )).rejects.toThrow(SECRET_REQUIRED)
  })

  it('refuses a setting the kind requires, naming it', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.save(submission({ settings: {} }), standing('platform-administrator')))
      .rejects.toThrow('corpId')
  })
})

describe('listing what one standing may configure', () => {
  it('shows a platform administrator every channel, and a tenant one only theirs', async () => {
    const ctx = await bench()
    await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    await ctx.signInChannels.save(submission({ organization: 'acme' }), standing('tenant-administrator', 'acme'))
    await ctx.signInChannels.save(submission({ organization: 'zenith' }), standing('tenant-administrator', 'zenith'))

    expect(await ctx.signInChannels.list(standing('platform-administrator'))).toHaveLength(3)
    const theirs = await ctx.signInChannels.list(standing('tenant-administrator', 'acme'))
    expect(theirs.map(one => one.organization)).toEqual(['acme'])
    expect(await ctx.signInChannels.list(standing('member', 'acme'))).toEqual([])
  })
})

describe('removing one channel', () => {
  it('takes it off the sign-in page and takes its secret with it', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    await ctx.signInChannels.remove(saved.id, standing('platform-administrator'))
    expect(ctx.signIn.available()).toEqual([])
    expect(stored.has(secretRefOf(saved.id))).toBe(false)
    expect(await ctx.signInChannels.list(standing('platform-administrator'))).toEqual([])
  })

  it('refuses a standing that may not configure it', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission({ organization: 'acme' }), standing('tenant-administrator', 'acme'))
    await expect(ctx.signInChannels.remove(saved.id, standing('tenant-administrator', 'zenith')))
      .rejects.toThrow(NOT_PERMITTED)
  })

  it('does nothing for a channel that is not there', async () => {
    const ctx = await bench()
    await expect(ctx.signInChannels.remove('gone', standing('platform-administrator'))).resolves.toBeUndefined()
  })
})

describe('a record its kind cannot build', () => {
  it('stays stored and unmounted, so an administrator can correct it', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    refused = 'that corpid is not one'
    await ctx.signInChannels.save({ ...submission(), id: saved.id }, standing('platform-administrator'))
    expect(ctx.signIn.available()).toEqual([])
    const listed = await ctx.signInChannels.list(standing('platform-administrator'))
    expect(listed).toMatchObject([{ id: saved.id, mounted: false }])
  })

  it('stays stored and unmounted when no plugin offers its kind any more', async () => {
    const ctx = await bench()
    const saved = await ctx.signInChannels.save(submission(), standing('platform-administrator'))
    await ctx.fiber.dispose()
    live.splice(live.indexOf(ctx), 1)

    // The same storage root, booted without the plugin that offered the kind.
    const without = await bench([])
    expect(without.signIn.available()).toEqual([])
    expect(await without.signInChannels.list(standing('platform-administrator')))
      .toMatchObject([{ id: saved.id, mounted: false }])
  })
})
