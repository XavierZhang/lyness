/**
 * What the page may send, and what a patch layer may say back.
 *
 * Both sides are parsed rather than trusted: the page is a browser document,
 * and the layer is a file an operator may have edited by hand.
 */
import { describe, expect, it } from 'vitest'
import { parseSubmission, readCurrentBrand, SubmissionError } from '../src/brand-request.ts'

/** One valid submission, as the page sends it. */
const ICON = Buffer.from('an icon').toString('base64')
const VALID = { acceptTrademark: true, productName: 'Acme Agent', icon: ICON }

function submit(body: unknown): ReturnType<typeof parseSubmission> {
  return parseSubmission(JSON.stringify(body))
}

describe('a submission from the page', () => {
  it('keeps every field the page filled and drops the ones it left empty', () => {
    const complete = submit({
      ...VALID,
      productAbbreviation: 'ACME',
      productNameZh: '艾可',
      themeColor: '#1a73e8',
      colors: { blue: '#1a73e8', gray50: 'white' },
    })
    expect(complete).toMatchObject({
      productName: 'Acme Agent',
      productAbbreviation: 'ACME',
      productNameZh: '艾可',
      themeColor: '#1a73e8',
      colors: { blue: '#1a73e8', gray50: 'white' },
    })
    expect(Buffer.from(complete.icon).toString()).toBe('an icon')

    // The page posts its untouched inputs as empty strings.
    const sparse = submit({ ...VALID, productAbbreviation: '', productNameZh: '', themeColor: '', colors: {} })
    expect(sparse.productAbbreviation).toBeUndefined()
    expect(sparse.productNameZh).toBeUndefined()
    expect(sparse.themeColor).toBeUndefined()
    expect(sparse.colors).toEqual({})
  })

  it('ignores a colour key no palette token names', () => {
    expect(submit({ ...VALID, colors: { accent: '#ff0000', blue: '#1a73e8' } }).colors).toEqual({ blue: '#1a73e8' })
  })

  it('reads a submission that carries no colours at all', () => {
    expect(submit(VALID).colors).toEqual({})
    expect(submit({ ...VALID, colors: null }).colors).toEqual({})
  })

  it.each([
    ['text that is not JSON', 'not json', /not JSON/u],
    ['a body that is not an object', '"Acme"', /must be an object/u],
    ['a body that is null', 'null', /must be an object/u],
  ])('refuses %s', (_case, body, message) => {
    expect(() => parseSubmission(body)).toThrow(message)
    expect(() => parseSubmission(body)).toThrow(SubmissionError)
  })

  it.each([
    ['an unconfirmed trademark', { productName: 'Acme', icon: ICON }, /trademark/u],
    ['a trademark flag that is not true', { ...VALID, acceptTrademark: 'yes' }, /trademark/u],
    ['no product name', { acceptTrademark: true, icon: ICON }, /productName is required/u],
    ['a product name that is not text', { ...VALID, productName: 7 }, /productName must be text/u],
    ['no icon', { acceptTrademark: true, productName: 'Acme' }, /icon PNG is required/u],
    ['an icon that is not text', { ...VALID, icon: 7 }, /icon must be text/u],
    ['colours that are not an object', { ...VALID, colors: 'blue' }, /colors must be an object/u],
    ['a colour that is not text', { ...VALID, colors: { blue: 7 } }, /colors\.blue must be text/u],
  ])('refuses %s', (_case, body, message) => {
    expect(() => submit(body)).toThrow(message)
  })

  it('refuses an icon that did not decode as base64', () => {
    expect(() => submit({ ...VALID, icon: '!!!!' })).toThrow(/did not decode/u)
  })
})

describe('the brand a patch layer already names', () => {
  const empty = { config: {}, colors: {} }

  it('reads the names and palette tokens of every brand row', () => {
    const layer = [
      '- id: brand-deployment',
      '  config:',
      '    productName: Acme Agent',
      '    productAbbreviation: ACME',
      '    productNameZh: 艾可',
      '    themeColor: "#1a73e8"',
      '    showPoweredBy: true',
      '    colors:',
      '      blue: "#1a73e8"',
      '      accent: "#ff0000"',
      '',
    ].join('\n')
    expect(readCurrentBrand(layer)).toEqual({
      // `showPoweredBy` is not a name the page writes, so it never reaches it.
      config: { productName: 'Acme Agent', productAbbreviation: 'ACME', productNameZh: '艾可', themeColor: '#1a73e8' },
      colors: { blue: '#1a73e8' },
    })
  })

  it.each([
    ['a layer that does not exist yet', ''],
    ['a layer that is not valid YAML', '- [unclosed\n'],
    ['a layer that is not an array of rows', 'id: brand-deployment\n'],
    ['a layer whose rows are not maps', '- brand-deployment\n'],
    ['a layer with no brand row', '- id: system-prompt\n  config:\n    productName: Acme\n'],
    ['a brand row with no config', '- id: brand-deployment\n'],
    ['a brand row whose config is null', '- id: brand-deployment\n  config: null\n'],
    ['a brand row whose colours are not a map', '- id: brand-deployment\n  config:\n    colors: blue\n'],
    ['a name that is not text', '- id: brand-deployment\n  config:\n    productName: 7\n'],
  ])('reads %s as naming nothing', (_case, layer) => {
    expect(readCurrentBrand(layer)).toEqual(empty)
  })

  it('reads a colour that is not text as absent', () => {
    expect(readCurrentBrand('- id: brand-deployment\n  config:\n    colors:\n      blue: 7\n')).toEqual(empty)
  })
})
