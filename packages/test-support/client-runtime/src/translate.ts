/**
 * Test double of the locale lookup chain: a translate stub over plain
 * dictionaries, mirroring LocaleRuntime's resolution order (first dictionary
 * that owns the key wins, then the key itself stays visible) and its
 * `{name}` template interpolation. Specs stub the framework-injected `t`
 * seat with `makeTranslate(zh, commonZh)` instead of re-implementing the
 * chain per suite.
 *
 * Brand placeholders fill like they do in the product, so a spec asserts the
 * text a reader sees rather than the template a dictionary writes. A spec
 * cannot take the values from `dsh-client-locale` the way the service does:
 * this module ships as published JavaScript, and that package's client entry
 * carries the Cordis plugin graph. `brand-values.client.spec.ts` keeps the two
 * tables equal.
 */

/**
 * The built-in brand names, as `dsh-client-locale` declares them for a
 * deployment that renamed nothing. Specs run with no deployment brand on the
 * page, so these are the names their assertions read.
 */
const BUILT_IN_BRAND: Readonly<Record<string, string>> = {
  brandName: 'HARNESS',
  brandAbbr: 'DSH',
  brandNameZh: '领驭',
}

/**
 * Fill the built-in brand names into one dictionary template.
 *
 * A spec that states its expectation as the dictionary entry rather than as
 * literal copy needs the same substitution {@link makeTranslate} performs,
 * or it compares rendered text against an unfilled template.
 * @param template - the dictionary value, with its `{brandName}` style placeholders.
 * @returns the text a reader sees, with every brand placeholder filled.
 */
export function fillBrand(template: string): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in BUILT_IN_BRAND ? String(BUILT_IN_BRAND[name]) : match)
}

/**
 * Fill the built-in brand names through one whole dictionary.
 *
 * A spec that states most of its expectations as dictionary entries reads
 * better over a filled view of the dictionary than with {@link fillBrand} at
 * every site.
 * @param dictionary - the locale dictionary as its module declares it.
 * @returns the same keys, each value carrying the text a reader sees.
 */
export function fillBrandDictionary<T extends Record<string, string>>(dictionary: T): T {
  return Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key, fillBrand(value)])) as T
}

/**
 * Build a translate stub resolving through `dicts` in order (namespace
 * first, then the shared common vocabulary), falling back to the key.
 * @param dicts - dictionaries consulted in order.
 * @returns the translate function (assignable to any `XxxProps['t']` seat).
 */
export function makeTranslate(
  ...dicts: readonly Record<string, string>[]
): (key: string, params?: Record<string, unknown>) => string {
  return (key, params) => {
    let template = key
    for (const dict of dicts) {
      const hit = dict[key]
      if (hit !== undefined) {
        template = hit
        break
      }
    }
    const values = params === undefined ? BUILT_IN_BRAND : { ...BUILT_IN_BRAND, ...params }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match)
  }
}
