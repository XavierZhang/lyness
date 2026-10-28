/**
 * The product names the Electron shell's own copy says the product's name in.
 *
 * The shell writes its copy as placeholders — `{brandName}`, `{brandAbbr}`,
 * `{brandNameZh}` — the same way product dictionaries do, so a private
 * deployment that packaged its own build reads as its own product in the menu,
 * the quit prompt and the startup failures.
 *
 * The names arrive as packaging metadata rather than from the composed profile:
 * the copy that needs them most renders when startup failed or the port was
 * already taken, which is exactly when no profile has loaded. The main process
 * reads them from the packaged manifest; the welcome window resolves its own
 * dictionary in its renderer, so that window receives them the way it already
 * receives its locale — as window arguments.
 */

import { BUILT_IN_BRAND } from './brand-names.ts'

/** Manifest keys `electron-builder-config.mjs` writes into the packaged manifest. */
const MANIFEST_KEYS = {
  brandName: 'lynBrandName',
  brandAbbr: 'lynBrandAbbr',
  brandNameZh: 'lynBrandNameZh',
} as const

/** Window argument carrying each name to a renderer that resolves its own copy. */
const BRAND_ARGUMENTS = {
  brandName: '--lyn-brand-name=',
  brandAbbr: '--lyn-brand-abbr=',
  brandNameZh: '--lyn-brand-name-zh=',
} as const

/** One placeholder the shell's copy writes. */
type BrandPlaceholder = keyof typeof BRAND_ARGUMENTS

const PLACEHOLDERS: readonly BrandPlaceholder[] = ['brandName', 'brandAbbr', 'brandNameZh']

/**
 * A name the shell's copy can carry: one line, no placeholder syntax of its own.
 *
 * The copy fills a placeholder with this name, so a brace would reopen
 * substitution and a line break would split the sentence carrying it. The rule
 * matches the one `brand-deployment` applies to the same three names.
 */
const BRAND_NAME = /^[^\n\r{}]{1,64}$/u

/**
 * Read one usable name from a packaged manifest.
 * @param manifest - the parsed packaged manifest.
 * @param key - the manifest key to read.
 * @returns the name, or undefined when the key is absent or unusable.
 */
function manifestName(manifest: object, key: string): string | undefined {
  const value: unknown = Reflect.get(manifest, key)
  return typeof value === 'string' && BRAND_NAME.test(value) ? value : undefined
}

/**
 * Resolve the three names a packaged build carries.
 *
 * They resolve as one set: a build that packaged any of them takes the others
 * from the one it named, so a build named Acme never shows `LYN` or 领驭 beside
 * its own name. A build that packaged none shows all three built-in names.
 * @param manifest - the parsed packaged manifest, or any non-object when the
 * launch has none.
 * @returns every placeholder name with the value that fills it.
 */
export function resolveDesktopBrand(manifest: unknown): Readonly<Record<string, string>> {
  if (typeof manifest !== 'object' || manifest === null) return BUILT_IN_BRAND
  const carried = {
    brandName: manifestName(manifest, MANIFEST_KEYS.brandName),
    brandAbbr: manifestName(manifest, MANIFEST_KEYS.brandAbbr),
    brandNameZh: manifestName(manifest, MANIFEST_KEYS.brandNameZh),
  }
  const named = carried.brandName ?? carried.brandAbbr ?? carried.brandNameZh
  if (named === undefined) return BUILT_IN_BRAND
  return {
    brandName: carried.brandName ?? named,
    brandAbbr: carried.brandAbbr ?? named,
    brandNameZh: carried.brandNameZh ?? named,
  }
}

/**
 * The window arguments that carry these names to a renderer.
 * @param brand - names from {@link resolveDesktopBrand}.
 * @returns one argument per name, for `webPreferences.additionalArguments`.
 */
export function desktopBrandArguments(brand: Readonly<Record<string, string>>): string[] {
  return PLACEHOLDERS.flatMap((placeholder) => {
    const value = brand[placeholder]
    return value === undefined ? [] : [`${BRAND_ARGUMENTS[placeholder]}${value}`]
  })
}

/**
 * Read the names a window was opened with.
 * @param argv - the renderer process arguments.
 * @returns the names carried, with a built-in one wherever the window carried
 * none or carried one the copy could not take.
 */
export function readDesktopBrandArguments(argv: readonly string[]): Readonly<Record<string, string>> {
  const values: Record<string, string> = { ...BUILT_IN_BRAND }
  for (const placeholder of PLACEHOLDERS) {
    const prefix = BRAND_ARGUMENTS[placeholder]
    const carried = argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
    if (carried !== undefined && BRAND_NAME.test(carried)) values[placeholder] = carried
  }
  return values
}
