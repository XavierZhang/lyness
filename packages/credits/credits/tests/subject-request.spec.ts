/**
 * Charging the call in progress to the person it speaks for — and charging
 * nobody when it speaks for nobody.
 */

import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { expect, it } from 'vitest'
import RequestCreditSubject from '../src/subject-request.ts'

const ADA = brandString<PersonId>('ada')

/** A context whose principal is whatever the test fixed. */
async function harness(person: PersonId | undefined): Promise<Context> {
  const ctx = new Context()
  ctx.provide('requestPrincipal', {
    current: () => person === undefined ? undefined : { person, acting: { person } },
  })
  await ctx.plugin(RequestCreditSubject).await()
  return ctx
}

it('charges the signed-in person of the call in progress', async () => {
  const ctx = await harness(ADA)

  expect(await ctx.creditSubject.current()).toBe(ADA)
})

it('charges nobody when the call speaks for nobody', async () => {
  const ctx = await harness(undefined)

  // A deployment's own maintenance work, a replay, a seeded session: charging
  // these to whoever happens to be signed in would be worse than not charging.
  expect(await ctx.creditSubject.current()).toBeUndefined()
})
