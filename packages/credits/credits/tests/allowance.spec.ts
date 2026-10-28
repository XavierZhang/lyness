/**
 * How the deployment's numbers, an organization's override and a person's own
 * override fold into the allowance a periodic grant uses.
 */

import { describe, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import { allowanceKey, effectiveAllowance } from '../src/allowance.ts'
import type { EffectiveAllowance } from '../src/allowance.ts'

const BASE: EffectiveAllowance = { periodicAmount: 500, period: 'daily' }

describe('effectiveAllowance', () => {
  it('is the deployment own numbers when nobody overrode them', () => {
    expect(effectiveAllowance(BASE, undefined, undefined)).toEqual(BASE)
  })

  it('takes the organization override over the deployment default', () => {
    expect(effectiveAllowance(BASE, { periodicAmount: 2000 }, undefined))
      .toEqual({ periodicAmount: 2000, period: 'daily' })
  })

  it('takes a person own override over their organization', () => {
    expect(effectiveAllowance(BASE, { periodicAmount: 2000 }, { periodicAmount: 10 }))
      .toEqual({ periodicAmount: 10, period: 'daily' })
  })

  it('leaves a field an override says nothing about', () => {
    expect(effectiveAllowance(BASE, { period: 'monthly' }, { periodicAmount: 10 }))
      .toEqual({ periodicAmount: 10, period: 'monthly' })
  })

  it('treats zero as a decision, not as absence', () => {
    expect(effectiveAllowance(BASE, undefined, { periodicAmount: 0 }).periodicAmount).toBe(0)
  })
})

describe('allowanceKey', () => {
  it('separates an organization-wide override from a person one', () => {
    const person = brandString<PersonId>('acme')
    expect(allowanceKey('acme', undefined)).not.toBe(allowanceKey(undefined, person))
  })

  it('separates two organizations', () => {
    expect(allowanceKey('one', undefined)).not.toBe(allowanceKey('two', undefined))
  })
})
