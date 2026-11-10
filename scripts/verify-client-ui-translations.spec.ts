/**
 * What the untranslated-copy gate refuses: a Chinese entry holding the English
 * string. Format templates, proper nouns and example values read the same in
 * both languages and are listed rather than reported.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import ts from 'typescript'
import { dictionaryEntries, untranslated, untranslatedClientCopy } from './verify-client-ui-translations.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A fixture repository holding one Client dictionary. */
function repository(body: string, pkg = 'ui-probe', group = 'client'): string {
  const root = mkdtempSync(join(tmpdir(), 'lyn-ui-translations-'))
  roots.push(root)
  const directory = join(root, 'packages', group, pkg, 'src', 'client')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'locales.ts'), body)
  return root
}

/** Parse one dictionary module the way the gate does. */
function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('locales.ts', source, ts.ScriptTarget.ESNext, true)
}

describe('reading a dictionary', () => {
  it('reads entries through an `as` or `satisfies` wrapper, quoted keys included', () => {
    const found = dictionaryEntries(parse([
      'export const zh = {',
      "  plain: '普通',",
      "  'quoted.key': '带引号',",
      "  nested: { skipped: 'x' },",
      '} satisfies Record<string, string>',
      '',
    ].join('\n')), 'zh')
    expect([...found]).toEqual([['plain', '普通'], ['quoted.key', '带引号']])
  })
})

describe('what counts as untranslated', () => {
  it.each([
    ['English prose left in place', 'Base URL', 'Base URL', true],
    // A template reads the same in both languages, and the predicate cannot
    // tell that from prose: SHARED is where that judgment is recorded.
    ['a format template, which an exemption excuses', '{value} tok', '{value} tok', true],
    ['a genuine translation', '基础地址', 'Base URL', false],
    ['a symbol with no letters', '%', '%', false],
    ['Chinese that embeds a Latin term', 'API 密钥', 'API key', false],
    ['an empty English entry', '', '', false],
  ])('%s', (_case, chinese, english, expected) => {
    expect(untranslated(chinese, english)).toBe(expected)
  })
})

describe('the verdict', () => {
  const DICTIONARY = [
    "export const en = { greeting: 'Hello', progress: '{percent}%' }",
    "export const zh: Record<keyof typeof en, string> = { greeting: GREETING, progress: '{percent}%' }",
    '',
  ].join('\n')

  it('accepts a translated dictionary, and an identical entry that reads the same', () => {
    expect(untranslatedClientCopy(repository(DICTIONARY.replace('GREETING', "'你好'")))).toEqual([])
  })

  it('refuses a Chinese entry that is still the English string', () => {
    expect(untranslatedClientCopy(repository(DICTIONARY.replace('GREETING', "'Hello'")))).toEqual([
      'packages/client/ui-probe/src/client/locales.ts::greeting: '
      + 'the Chinese entry is still the English string "Hello"',
    ])
  })

  it('reads a dictionary outside packages/client, where experimental surfaces live', () => {
    const root = repository(DICTIONARY.replace('GREETING', "'Hello'"), 'client-ui-probe', 'experimental')
    expect(untranslatedClientCopy(root)).toEqual([
      'packages/experimental/client-ui-probe/src/client/locales.ts::greeting: '
      + 'the Chinese entry is still the English string "Hello"',
    ])
  })

  it('reports an empty corpus rather than passing silently', () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-ui-translations-empty-'))
    roots.push(root)
    expect(untranslatedClientCopy(root)).toEqual([`${root}: no Client dictionaries found`])
  })

  it('names a shared exemption this repository no longer needs', () => {
    // A stale exemption hides the next untranslated entry under the same key,
    // so the list has to shrink with the copy it excuses. Checked against the
    // real tree, where those dictionaries are the ones that were scanned.
    const real = untranslatedClientCopy()
    expect(real.filter(problem => problem.includes('drop the exemption'))).toEqual([])
  })
})
