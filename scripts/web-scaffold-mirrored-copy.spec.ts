/**
 * The web e2e scaffold mirrors product copy it cannot import.
 *
 * Host-side web e2e runs outside the browser graph, so `apps/web/tests/scaffold.ts`
 * restates the welcome notice rather than importing `@lyness/lyn-client-ui-settings-models`,
 * which would pull that package's complete TypeScript project into the host program.
 * The restated constants that drive acknowledgement fail loudly on drift — a stale
 * version stops suppressing the notice and every scenario sees a dialog it did not
 * expect. The restated *body* does not: it drifts silently until some scenario
 * compares rendered text, which is how a brand edit to the locale reached CI with
 * three web scenarios failing on copy nobody had looked at.
 *
 * Both sides are read as text so this check needs neither graph.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SCAFFOLD = fileURLToPath(new URL('../apps/web/tests/scaffold.ts', import.meta.url))
const LOCALES = fileURLToPath(new URL('../packages/client/ui-settings-models/src/client/locales.ts', import.meta.url))
const ONBOARDING = fileURLToPath(new URL('../packages/client/ui-settings-models/src/onboarding-copy.ts', import.meta.url))

/**
 * Read one single-quoted string assigned to `key` in a module's source.
 * @param source - Complete module text.
 * @param key - Property or constant name preceding the literal.
 * @returns The literal with its escapes intact, or undefined when absent.
 */
function literal(source: string, key: string): string | undefined {
  const match = new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(source)
  return match?.[1]
}

/**
 * Narrow a module's source to one exported dictionary.
 *
 * `locales.ts` declares `en` before `zh`, and the scaffold mirrors the Chinese
 * one, so a whole-file search would compare against the English copy.
 * @param source - Complete module text.
 * @param name - Exported dictionary name.
 * @returns The text from that declaration to the next top-level export, or the
 * tail of the file when it is the last one.
 */
function dictionary(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`)
  if (start === -1) throw new Error(`locales must export ${name}`)
  const next = source.indexOf('\nexport const ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

/**
 * Read one exported single- or double-quoted constant.
 * @param source - Complete module text.
 * @param name - Exported constant name.
 * @returns The literal, or undefined when absent.
 */
function exported(source: string, name: string): string | undefined {
  const match = new RegExp(`export const ${name} = ['"]([^'"]*)['"]`).exec(source)
  return match?.[1]
}

describe('web scaffold mirrored copy', () => {
  it('restates the Chinese welcome notice exactly as the product locale writes it', async () => {
    const [scaffold, locales] = await Promise.all([readFile(SCAFFOLD, 'utf8'), readFile(LOCALES, 'utf8')])
    const mirrored = literal(scaffold, 'body')
    const product = literal(dictionary(locales, 'zh'), 'welcomeBody')
    expect(product, 'ui-settings-models locales must define welcomeBody as a single-quoted literal').toBeDefined()
    expect(mirrored, 'scaffold must restate the notice body as a single-quoted literal').toBeDefined()
    expect(mirrored).toBe(product)
  })

  it('restates the acknowledgement constants exactly as their owning module writes them', async () => {
    const [scaffold, onboarding] = await Promise.all([readFile(SCAFFOLD, 'utf8'), readFile(ONBOARDING, 'utf8')])
    for (const name of ['WELCOME_NOTICE_SETTINGS_NAMESPACE', 'WELCOME_NOTICE_ACK_FIELD', 'WELCOME_NOTICE_VERSION']) {
      const owned = exported(onboarding, name)
      expect(owned, `${name} must be an exported literal`).toBeDefined()
      expect(exported(scaffold, name), `scaffold ${name}`).toBe(owned)
    }
  })

  it('restates the notice title and continue label from the same locale', async () => {
    const [scaffold, locales] = await Promise.all([readFile(SCAFFOLD, 'utf8'), readFile(LOCALES, 'utf8')])
    expect(literal(scaffold, 'title')).toBe(literal(dictionary(locales, 'zh'), 'welcomeTitle'))
    expect(literal(scaffold, 'continueLabel')).toBe(literal(dictionary(locales, 'zh'), 'welcomeContinue'))
  })
})
