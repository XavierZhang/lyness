/**
 * The three rules a declared context passes, and the refusal each produces.
 *
 * Every case calls the resolver directly, because it is the one operation that
 * decides this: a check in a transport or a surface would be bypassed by the
 * next caller.
 */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import StaticPeopleDirectory from '@deepseek-ai/dsh-people/static'
import { expect, it } from 'vitest'
import ActingContextResolver, { ActingContextRefused } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const BOB = brandString<PersonId>('bob')
const ADA_STANDING = brandString<MembershipId>('ada:tenant-administrator')
const BOB_STANDING = brandString<MembershipId>('bob:member')

/** A resolver over a two-person roster in one organization. */
async function harness(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(StaticPeopleDirectory, {
    people: [
      { id: 'ada', displayName: 'Ada', role: 'tenant-administrator', organization: 'acme' },
      { id: 'bob', displayName: 'Bob', role: 'member', organization: 'acme' },
    ],
  }).await()
  await ctx.plugin(ActingContextResolver).await()
  return ctx
}

/** The refusal code one claim produced. */
async function refusalOf(ctx: Context, claim: Parameters<ActingContextResolver['resolve']>[0]): Promise<string> {
  try {
    await ctx.actingContext.resolve(claim)
  } catch (error) {
    if (error instanceof ActingContextRefused) return error.code
    throw error
  }
  throw new Error('expected a refusal')
}

it('refuses a call that states no context rather than defaulting one', async () => {
  const ctx = await harness()

  // A person holding two standings makes a default a guess, and a guess here
  // attributes a conversation to the wrong organization.
  expect(await refusalOf(ctx, { person: ADA })).toBe('context-absent')
})

it('permits a standing the caller holds', async () => {
  const ctx = await harness()

  expect(await ctx.actingContext.resolve({
    person: ADA, declared: { kind: 'membership', membership: ADA_STANDING },
  })).toEqual({ person: ADA, membership: ADA_STANDING })
})

it('refuses a standing held by somebody else', async () => {
  const ctx = await harness()

  expect(await refusalOf(ctx, {
    person: ADA, declared: { kind: 'membership', membership: BOB_STANDING },
  })).toBe('membership-not-held')
})

it('refuses a standing that does not exist', async () => {
  const ctx = await harness()

  expect(await refusalOf(ctx, {
    person: ADA, declared: { kind: 'membership', membership: brandString<MembershipId>('nope') },
  })).toBe('membership-unknown')
})

it('permits the personal context on the platform address', async () => {
  const ctx = await harness()

  expect(await ctx.actingContext.resolve({ person: BOB, declared: { kind: 'personal' } }))
    .toEqual({ person: BOB })
})

it('refuses the personal context on an organization address', async () => {
  const ctx = await harness()

  // The address constrains the context and never chooses it, so this is a
  // refusal rather than a silent switch into the organization.
  expect(await refusalOf(ctx, {
    person: ADA, declared: { kind: 'personal' }, organization: 'acme',
  })).toBe('context-outside-address')
})

it('permits a standing of the organization the address resolved to', async () => {
  const ctx = await harness()

  expect(await ctx.actingContext.resolve({
    person: ADA, declared: { kind: 'membership', membership: ADA_STANDING }, organization: 'acme',
  })).toEqual({ person: ADA, membership: ADA_STANDING })
})

it('refuses a standing of a different organization than the address', async () => {
  const ctx = await harness()

  expect(await refusalOf(ctx, {
    person: ADA, declared: { kind: 'membership', membership: ADA_STANDING }, organization: 'other',
  })).toBe('context-outside-address')
})

it('carries a code a surface can map without parsing the message', async () => {
  const ctx = await harness()

  await expect(ctx.actingContext.resolve({ person: ADA })).rejects.toBeInstanceOf(ActingContextRefused)
  await expect(ctx.actingContext.resolve({ person: ADA })).rejects.toThrow(/states no acting context/)
})
