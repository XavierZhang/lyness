/**
 * Behaviour of the operator-written admission list.
 * @module
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { bindingKey, indexBindings } from '@lyness/lyn-sign-in/src/admission-roster.ts'
import type { BindingEntry } from '@lyness/lyn-sign-in/src/admission-roster.ts'
import { RosterAdmission } from '@lyness/lyn-sign-in/src/admission-roster.ts'
import { channelId } from '@lyness/lyn-sign-in/src/index.ts'
import type { ExternalSubject } from '@lyness/lyn-sign-in/src/types.ts'

const ENTRA: BindingEntry = {
  channel: 'microsoft-entra',
  issuer: 'contoso.onmicrosoft.com',
  subject: '7a1f',
  person: 'ada',
}

function subject(over: Partial<ExternalSubject> = {}): ExternalSubject {
  return {
    channel: channelId('microsoft-entra'),
    issuer: 'contoso.onmicrosoft.com',
    subject: '7a1f',
    ...over,
  }
}

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** The rule as a deployment gets it: mounted, so it is the service it provides. */
async function rule(bindings: readonly BindingEntry[]): Promise<RosterAdmission> {
  const ctx = new Context()
  await ctx.plugin(RosterAdmission, { bindings: [...bindings] }).await()
  live.push(ctx)
  return ctx.signInAdmission as RosterAdmission
}

describe('bindingKey', () => {
  it('separates one subject at two directories', () => {
    expect(bindingKey('c', 'one', 's')).not.toBe(bindingKey('c', 'two', 's'))
  })

  it('separates one directory reached through two channels', () => {
    expect(bindingKey('one', 'd', 's')).not.toBe(bindingKey('two', 'd', 's'))
  })

  it('does not collide when a part contains the separator', () => {
    expect(bindingKey('a', 'b', 'c')).not.toBe(bindingKey('a', 'b"', 'c'))
  })
})

describe('indexBindings', () => {
  it('rejects one directory identity bound twice', () => {
    expect(() => indexBindings([ENTRA, { ...ENTRA, person: 'grace' }]))
      .toThrow(/is bound twice/u)
  })

  it('keeps two identities that differ only by directory', () => {
    const index = indexBindings([ENTRA, { ...ENTRA, issuer: 'fabrikam.onmicrosoft.com', person: 'grace' }])
    expect(index.size).toBe(2)
  })
})

describe('RosterAdmission', () => {
  it('admits a written identity as the person it names', async () => {
    await expect((await rule([ENTRA])).admit(subject())).resolves.toBe(brandString<PersonId>('ada'))
  })

  it('admits nobody when the list is empty', async () => {
    await expect((await rule([])).admit(subject())).resolves.toBeUndefined()
  })

  it('refuses the same subject arriving from another directory', async () => {
    const admitted = await (await rule([ENTRA])).admit(subject({ issuer: 'fabrikam.onmicrosoft.com' }))
    expect(admitted).toBeUndefined()
  })

  it('refuses the same subject arriving through another channel', async () => {
    const admitted = await (await rule([ENTRA])).admit(subject({ channel: channelId('wecom') }))
    expect(admitted).toBeUndefined()
  })
})
