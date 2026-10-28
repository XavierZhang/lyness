/**
 * Brand placeholders fill from the page global, including in the calls that
 * pass no parameters of their own — which is most product copy, and the reason
 * the substitution could not stay behind the previous `if (!params)` return.
 *
 * The three names resolve as one set, so a deployment never shows a built-in
 * name beside its own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@lyness/lyn-client-test-runtime'

import { readBrandValues } from '../src/client/brand-values.ts'

const GLOBAL = 'lynDeploymentBrand'
const BUILT_IN = { brandName: 'lyness', brandAbbr: 'LYN', brandNameZh: '领驭' }

function withBrand(brand: unknown): void {
  Reflect.set(globalThis, GLOBAL, brand)
}

afterEach(() => { Reflect.deleteProperty(globalThis, GLOBAL) })

describe('brand placeholder values', () => {
  it('stands the built-in names when the page carries no brand', () => {
    expect(readBrandValues()).toEqual(BUILT_IN)
    withBrand(null)
    expect(readBrandValues()).toEqual(BUILT_IN)
    withBrand({})
    expect(readBrandValues()).toEqual(BUILT_IN)
  })

  it('keeps each name the deployment carries', () => {
    withBrand({ productName: 'Acme Agent', productAbbreviation: 'ACME', productNameZh: '艾可' })
    expect(readBrandValues()).toEqual({ brandName: 'Acme Agent', brandAbbr: 'ACME', brandNameZh: '艾可' })
  })

  it.each([
    ['only its product name', { productName: 'Acme Agent' }, 'Acme Agent'],
    ['only an abbreviation', { productAbbreviation: 'ACME' }, 'ACME'],
    ['only a Chinese name', { productNameZh: '艾可' }, '艾可'],
  ])('carries the names it left out from the one it gave, carrying %s', (_case, brand, expected) => {
    withBrand(brand)
    expect(readBrandValues()).toEqual({ brandName: expected, brandAbbr: expected, brandNameZh: expected })
  })

  it('replaces an unusable name with the deployment name, not the built-in one', () => {
    withBrand({ productName: 'Acme Agent', productAbbreviation: 'A{B}' })
    expect(readBrandValues()).toEqual({ brandName: 'Acme Agent', brandAbbr: 'Acme Agent', brandNameZh: 'Acme Agent' })
  })

  it.each([
    ['a brace, which would reopen substitution', 'Acme {brandName}'],
    ['a newline', 'Acme\nAgent'],
    ['a carriage return', 'Acme\rAgent'],
    ['an empty string', ''],
    ['prose rather than a name', 'A'.repeat(65)],
  ])('refuses %s and keeps the built-in names', (_case, value) => {
    withBrand({ productName: value })
    expect(readBrandValues()).toEqual(BUILT_IN)
  })

  it.each([
    ['a number', 1],
    ['null', null],
    ['an object', { toString: () => 'Acme' }],
  ])('refuses %s as a name', (_case, value) => {
    withBrand({ productName: value })
    expect(readBrandValues()).toEqual(BUILT_IN)
  })

  it('agrees with the names the translate double fills, which feature specs assert against', () => {
    const doubled = makeTranslate()
    for (const [placeholder, value] of Object.entries(readBrandValues())) {
      expect(doubled(`{${placeholder}}`), placeholder).toBe(value)
    }
  })
})
