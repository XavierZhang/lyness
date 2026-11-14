/**
 * Charging the call in progress to the person it speaks for and to the
 * organization they act for — and charging nobody when it speaks for nobody.
 */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Membership, MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import { expect, it } from 'vitest'
import RequestCreditSubject from '../src/subject-request.ts'

const ADA = brandString<PersonId>('ada')
const ADA_STANDING = brandString<MembershipId>('ada:member')

/** A context whose principal and standing are whatever the test fixed. */
async function harness(person: PersonId | undefined, standing?: Membership): Promise<Context> {
  const ctx = new Context()
  ctx.provide('requestPrincipal', {
    current: () => person === undefined
      ? undefined
      : { person, acting: { person, ...standing === undefined ? {} : { membership: standing.id } } },
  })
  ctx.provide('people', {
    person: () => Promise.resolve(undefined),
    membership: () => Promise.resolve(standing),
    memberships: () => Promise.resolve(standing === undefined ? [] : [standing]),
  } as never)
  await ctx.plugin(RequestCreditSubject).await()
  return ctx
}

it('charges the signed-in person and the organization they act for', async () => {
  const ctx = await harness(ADA, {
    id: ADA_STANDING, person: ADA, role: 'member', organization: 'acme',
  })

  // The organization comes from the standing the directory holds, never from
  // anything the caller named: a caller that could name its own would be
  // choosing whose budget to spend.
  expect(await ctx.creditSubject.current()).toEqual({ person: ADA, organization: 'acme' })
})

it('charges a person who holds standing in no organization to themselves alone', async () => {
  const ctx = await harness(ADA, { id: ADA_STANDING, person: ADA, role: 'platform-administrator' })

  expect(await ctx.creditSubject.current()).toEqual({ person: ADA })
})

it('charges the person when the call declares no standing at all', async () => {
  const ctx = await harness(ADA)

  expect(await ctx.creditSubject.current()).toEqual({ person: ADA })
})

it('charges nobody when the call speaks for nobody', async () => {
  const ctx = await harness(undefined)

  // A deployment's own maintenance work, a replay, a seeded session: charging
  // these to whoever happens to be signed in would be worse than not charging.
  expect(await ctx.creditSubject.current()).toBeUndefined()
})
