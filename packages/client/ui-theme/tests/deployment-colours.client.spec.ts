/**
 * The page global is script-assigned page data, so the reader admits only the
 * tokens it names and only values that parse as a colour. These cases pin the
 * refusals, not just the happy path: a value that reached `setProperty`
 * unchecked would reach the stylesheet.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { readDeploymentColours } from '../src/client/deployment-colours.ts'

const GLOBAL = 'lynDeploymentBrand'

function withBrand(brand: unknown): void {
  Reflect.set(globalThis, GLOBAL, brand)
}

afterEach(() => { Reflect.deleteProperty(globalThis, GLOBAL) })

describe('deployment colour overrides', () => {
  it('reads nothing when the page carries no brand, no colours, or an empty map', () => {
    expect(readDeploymentColours()).toEqual([])
    withBrand(null)
    expect(readDeploymentColours()).toEqual([])
    withBrand({})
    expect(readDeploymentColours()).toEqual([])
    withBrand({ colors: {} })
    expect(readDeploymentColours()).toEqual([])
  })

  it('maps each named token to the custom property the palette declares', () => {
    withBrand({ colors: { blue: '#123456', blueDark: 'navy', gray50: '#ABC', success: '#0f0f0fff' } })
    expect(readDeploymentColours()).toEqual([
      ['--lyness-blue', '#123456'],
      ['--lyness-blue-dark', 'navy'],
      ['--lyness-gray-50', '#ABC'],
      ['--lyness-success', '#0f0f0fff'],
    ])
  })

  it('refuses a key the palette does not declare', () => {
    withBrand({ colors: { blue: '#123456', accent: '#ff0000', '--lyness-blue': '#ff0000' } })
    expect(readDeploymentColours()).toEqual([['--lyness-blue', '#123456']])
  })

  it.each([
    ['a declaration tail', 'red; position: fixed'],
    ['a url', 'url(data:,x)'],
    ['a function', 'rgb(1,2,3)'],
    ['a var reference', 'var(--lyness-black)'],
    ['an empty string', ''],
    ['a comment', '#fff/*x*/'],
    ['a five-digit hex', '#12345'],
  ])('refuses %s as a colour', (_name, value) => {
    withBrand({ colors: { blue: value } })
    expect(readDeploymentColours()).toEqual([])
  })

  it.each([
    ['a number', 1],
    ['null', null],
    ['an object', { toString: () => 'red' }],
    ['an array', ['red']],
  ])('refuses %s as a value', (_name, value) => {
    withBrand({ colors: { blue: value } })
    expect(readDeploymentColours()).toEqual([])
  })

  it('keeps the usable tokens when a sibling is unusable', () => {
    withBrand({ colors: { blue: '#123456', error: 'red; x: y' } })
    expect(readDeploymentColours()).toEqual([['--lyness-blue', '#123456']])
  })
})
