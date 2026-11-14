/**
 * Every Chinese entry in a Client dictionary is Chinese, not the English one
 * left in place.
 *
 * The key set is already guaranteed: a dictionary declares
 * `Record<keyof typeof en, string>`, so a missing key fails the compiler, and
 * `verify-client-ui-i18n` keeps copy out of components. What neither catches
 * is an entry whose Chinese value is still the English string — the product
 * then shows English to a Chinese reader, and nothing says so.
 *
 * Plenty of entries are identical on purpose: a format template
 * (`{value} tok`), a protocol or product name (`OpenAI Chat Completions`), a
 * placeholder URL. Those are listed in {@link SHARED}, which is what makes a
 * new untranslated entry visible rather than lost among them.
 * @module scripts/verify-client-ui-translations
 */

import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

/** Repository root, resolved from this script's own location. */
const root = resolve(import.meta.dirname, '..')

/**
 * Entries whose Chinese copy is the English string on purpose, by
 * `<dictionary path>::<key>`.
 *
 * Each is a format template, a proper noun, a protocol name, or an example
 * value — text that reads the same in both languages. Nothing here is prose.
 */
const SHARED: ReadonlySet<string> = new Set([
  // Proper nouns and an example value: the two languages genuinely read the same.
  'packages/client/ui-settings-models/src/client/locales.ts::protocolGemini',
  'packages/client/ui-settings-models/src/client/locales.ts::customGeminiBaseUrlPlaceholder',
  'packages/client/ui-sidebar-terminal/src/client/locales.ts::badge.agent',
  'packages/experimental/client-ui-forge/src/client/locales.ts::thread.bot',
  'packages/client/ui-conversation/src/client/locales.ts::web.http',
  'packages/client/ui-input-trigger/src/client/locales.ts::drill.key',
  'packages/client/ui-plugin-manager/src/client/locales.ts::installGuideIdExample',
  'packages/client/ui-plugin-manager/src/client/locales.ts::registryCustomPlaceholder',
  'packages/client/ui-plugin-market/src/client/locales.ts::sourcePlaceholder',
  'packages/client/ui-settings-models/src/client/locales.ts::protocolOpenAiCompletions',
  'packages/client/ui-settings-models/src/client/locales.ts::protocolOpenAiResponses',
  'packages/client/ui-settings-models/src/client/locales.ts::protocolAnthropicMessages',
  'packages/client/ui-settings-models/src/client/locales.ts::customBaseUrlPlaceholder',
  'packages/client/ui-settings-models/src/client/locales.ts::customAnthropicBaseUrlPlaceholder',
  'packages/client/ui-settings-web-search/src/client/locales.ts::providerDeepSeek',
  'packages/client/ui-settings-web-search/src/client/locales.ts::providerDeepSeekFetch',
  'packages/client/ui-shortcuts/src/client/locales.ts::desktop-document',
  'packages/client/ui-subagent/src/client/locales.ts::tokens.total',
  'packages/client/ui-trajectory/src/client/locales.ts::unit.tokens',
  'packages/client/ui-trajectory/src/client/locales.ts::unit.tokensPerSecond',
  'packages/client/ui-trajectory/src/client/locales.ts::tab.schema',
  'packages/client/ui-trajectory/src/client/locales.ts::record.json',
  // Proper nouns a Chinese reader sees in Latin script too.
  'packages/experimental/client-ui-cot-translation/src/client/locales.ts::bing',
  'packages/experimental/client-ui-cot-translation/src/client/locales.ts::google',
  'packages/experimental/client-ui-stats/src/client/locales.ts::trigger.webhook',
  'packages/experimental/client-ui-voice-input/src/client/locales.ts::sourceHuggingFace',
  'packages/experimental/liveshare/src/client/locales.ts::viewer.brand',
])

/** Characters that make a value Chinese rather than a borrowed English one. */
const CJK = /[㐀-鿿　-〿＀-￯]/u

/** Three or more Latin letters in a row: the value reads as English words. */
const ENGLISH_WORD = /[A-Za-z]{3}/u

/** `{placeholder}` spans, whose names are code rather than copy. */
const PLACEHOLDER = /\{[^}]*\}/gu

/**
 * One dictionary's string entries.
 * @param source - the parsed dictionary module.
 * @param name - the exported dictionary name.
 * @returns each key's string value, in declaration order.
 */
export function dictionaryEntries(source: ts.SourceFile, name: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>()
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== name) continue
      let initializer = declaration.initializer
      while (initializer !== undefined && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))) {
        initializer = initializer.expression
      }
      if (initializer === undefined || !ts.isObjectLiteralExpression(initializer)) continue
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) continue
        found.set(property.name.getText(source).replaceAll(/^['"]|['"]$/gu, ''), property.initializer.text)
      }
    }
  }
  return found
}

/**
 * Whether one entry reads as English copy left in the Chinese dictionary.
 * @param chinese - the Chinese value.
 * @param english - the English value.
 * @returns true when the two are the same English prose.
 */
export function untranslated(chinese: string, english: string): boolean {
  if (english === '' || chinese !== english) return false
  // A placeholder's name is code: `{percent}%` reads the same in both
  // languages and must not count as English copy.
  const copy = chinese.replaceAll(PLACEHOLDER, '')
  return !CJK.test(copy) && ENGLISH_WORD.test(copy)
}

/**
 * Report every Chinese entry that still holds its English string.
 * @param repository - repository root to scan.
 * @returns one diagnostic per untranslated entry, plus any stale exemption.
 */
export function untranslatedClientCopy(repository: string = root): readonly string[] {
  const files = globSync('packages/*/*/src/client/locales.ts', { cwd: repository }).sort()
  if (files.length === 0) return [`${repository}: no Client dictionaries found`]
  const problems: string[] = []
  const seen = new Set<string>()
  const scanned = new Set<string>()
  for (const relativePath of files) {
    const file = relativePath.replaceAll('\\', '/')
    const source = ts.createSourceFile(file, readFileSync(resolve(repository, file), 'utf8'), ts.ScriptTarget.ESNext, true)
    const english = dictionaryEntries(source, 'en')
    const chinese = dictionaryEntries(source, 'zh')
    if (english.size === 0 || chinese.size === 0) continue
    scanned.add(file)
    for (const [key, value] of chinese) {
      const counterpart = english.get(key)
      if (counterpart === undefined || !untranslated(value, counterpart)) continue
      const id = `${file}::${key}`
      seen.add(id)
      if (!SHARED.has(id)) problems.push(`${id}: the Chinese entry is still the English string ${JSON.stringify(value)}`)
    }
  }
  // Only against dictionaries this scan actually read: a run over a fixture
  // tree holds none of them, and absence there says nothing about the entry.
  for (const id of SHARED) {
    const [file] = id.split('::')
    if (file === undefined || !scanned.has(file) || seen.has(id)) continue
    problems.push(`${id}: exempted, but its Chinese and English entries already differ — drop the exemption`)
  }
  return problems
}

if (import.meta.main) {
  const problems = untranslatedClientCopy()
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) {
    console.error(
      'verify-client-ui-translations: translate each entry above, or add it to SHARED when the two languages '
      + 'genuinely read the same (a format template, a proper noun, an example value).',
    )
    process.exitCode = 1
  } else {
    console.log(`verify-client-ui-translations: every Chinese Client entry is Chinese (${String(SHARED.size)} shared on purpose).`)
  }
}
