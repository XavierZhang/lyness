/**
 * What the store keeps and what a session carries afterwards: one record per
 * session, the text verbatim, and whose instructions each product shape
 * answers with.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import AgentRegistry from '@lyness/lyn-agent'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import SessionStore from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import SystemPrompt from '@lyness/lyn-system-prompt'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import * as PersonalInstructions from '../src/index.ts'
import { MAX_INSTRUCTIONS_CHARS, SOLE_OPERATOR, ownerOfPerson, resolveConfig } from '../src/index.ts'
import type { PersonalInstructionsRecord } from '../src/index.ts'

const roots: string[] = []
const live: Context[] = []
afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** The person a signed-in bench speaks for. */
const ADA = brandString<PersonId>('ada')

/**
 * A deployment with durable storage, sessions, agents and the plugin.
 * @param options - whether a principal service is mounted, and who it names.
 * @returns the booted context.
 */
async function bench(options: { person?: PersonId; accounts?: boolean; root?: string } = {}): Promise<Context> {
  const root = options.root ?? mkdtempSync(join(tmpdir(), 'lyn-instructions-'))
  if (options.root === undefined) roots.push(root)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SystemPrompt, {}).await()
  // The accounts shape is the one that mounts a principal; the single
  // operator mounts none, which is the fact the store reads.
  if (options.accounts === true) {
    ctx.provide('requestPrincipal', {
      current: () => options.person === undefined
        ? undefined
        : { person: options.person, acting: {} },
    })
  }
  await ctx.plugin(PersonalInstructions, {}).await()
  return ctx
}

/**
 * Every instructions record one session's log holds.
 * @param session - the session to read.
 * @returns the records in log order.
 */
function records(session: Session): PersonalInstructionsRecord[] {
  return session.ownEvents()
    .filter(event => event.type === 'person/instructions')
    .map(event => event.data)
}

describe('resolveConfig', () => {
  it('accepts what the store accepts when a caller names no ceiling', () => {
    expect(resolveConfig({})).toEqual({ maxChars: MAX_INSTRUCTIONS_CHARS })
  })

  it('keeps a smaller ceiling a deployment set', () => {
    expect(resolveConfig({ maxChars: 400 })).toEqual({ maxChars: 400 })
  })
})

describe('the store', () => {
  it('keeps what a person wrote and reads it back', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    const owner = ownerOfPerson(ADA)
    expect(ctx.personalInstructions.get(owner)).toBeUndefined()
    const entry = await ctx.personalInstructions.save(owner, '  Call me Sam.  ')
    // Trimmed on the way in, so a log never records the whitespace a text
    // field happened to carry.
    expect(entry?.text).toBe('Call me Sam.')
    expect(ctx.personalInstructions.get(owner)?.text).toBe('Call me Sam.')
  })

  it('clears the record rather than storing an empty one', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    const owner = ownerOfPerson(ADA)
    await ctx.personalInstructions.save(owner, 'Call me Sam.')
    expect(await ctx.personalInstructions.save(owner, '   ')).toBeUndefined()
    expect(ctx.personalInstructions.get(owner)).toBeUndefined()
  })

  it('refuses more than this deployment accepts', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    await expect(ctx.personalInstructions.save(ownerOfPerson(ADA), 'x'.repeat(MAX_INSTRUCTIONS_CHARS + 1)))
      .rejects.toThrow(/at most/u)
  })

  it('carries a failed write back to its own caller', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    const store = ctx.personalInstructions
    await ctx.fiber.dispose()
    live.splice(live.indexOf(ctx), 1)
    // The store is closed; the write fails loudly rather than reading as a
    // save that landed.
    await expect(store.save(ownerOfPerson(ADA), 'Call me Sam.')).rejects.toThrow()
  })

  it('keeps one person apart from another', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    const other = ownerOfPerson(brandString<PersonId>('bo'))
    await ctx.personalInstructions.save(ownerOfPerson(ADA), 'Call me Sam.')
    expect(ctx.personalInstructions.get(other)).toBeUndefined()
  })

  it('survives a restart over the same storage root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-instructions-'))
    roots.push(root)
    const first = await bench({ accounts: true, person: ADA, root })
    await first.personalInstructions.save(ownerOfPerson(ADA), 'Call me Sam.')
    await first.fiber.dispose()
    live.splice(live.indexOf(first), 1)
    const second = await bench({ accounts: true, person: ADA, root })
    expect(second.personalInstructions.get(ownerOfPerson(ADA))?.text).toBe('Call me Sam.')
  })
})

describe('whose instructions a call acts on', () => {
  it('names the single operator when the deployment mounts no principal', async () => {
    const ctx = await bench()
    expect(ctx.personalInstructions.ownerOfCall()).toBe(SOLE_OPERATOR)
  })

  it('names the signed-in person when it does', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    expect(ctx.personalInstructions.ownerOfCall()).toBe(ownerOfPerson(ADA))
  })

  it('names nobody for a call that presented no identity', async () => {
    const ctx = await bench({ accounts: true })
    expect(ctx.personalInstructions.ownerOfCall()).toBeUndefined()
  })
})

describe('the session stamp', () => {
  it('records what the person had written when the session was created', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    await ctx.personalInstructions.save(ownerOfPerson(ADA), 'Call me Sam.')
    // The stamp runs on the microtask after the read-only creation
    // announcement, so reading the record waits that turn.
    const session = ctx.sessions.create()
    await Promise.resolve()
    const [record] = records(session)
    expect(record).toMatchObject({ version: 1, owner: ownerOfPerson(ADA), text: 'Call me Sam.' })
    // The instant comes from the save, so the test pins that one is recorded
    // rather than which one.
    expect(typeof record?.writtenAt).toBe('string')
  })

  it('records an empty text rather than nothing when they have written none', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    const session = ctx.sessions.create()
    await Promise.resolve()
    // The record is what a later reader checks to know the session ran with no
    // instructions, rather than that nothing was ever asked.
    expect(records(session)).toEqual([{ version: 1, owner: ownerOfPerson(ADA), text: '' }])
  })

  it('leaves a session nobody opened unstamped', async () => {
    const ctx = await bench({ accounts: true })
    const session = ctx.sessions.create()
    await Promise.resolve()
    expect(records(session)).toEqual([])
  })

  it('keeps what a session was created with when the person edits afterwards', async () => {
    const ctx = await bench({ accounts: true, person: ADA })
    await ctx.personalInstructions.save(ownerOfPerson(ADA), 'Call me Sam.')
    const session = ctx.sessions.create()
    await Promise.resolve()
    await ctx.personalInstructions.save(ownerOfPerson(ADA), 'Call me Alex.')
    expect(records(session).map(one => one.text)).toEqual(['Call me Sam.'])
  })

  it('stamps a session that existed before the plugin mounted, once', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-instructions-'))
    roots.push(root)
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root })
    await ctx.plugin(StorageDomain, { backend: 'json' })
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(SystemPrompt, {}).await()
    const session = ctx.sessions.create()
    const first = await ctx.plugin(PersonalInstructions, {}).await()
    expect(records(session)).toHaveLength(1)
    // Mounted again over a session that already carries a record — a restart,
    // or a composition reloaded — the stamp leaves it as it is.
    await first.dispose()
    await ctx.plugin(PersonalInstructions, {}).await()
    expect(records(session)).toHaveLength(1)
  })
})
