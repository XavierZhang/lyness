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
 * cannot take the values from `lyn-client-locale` the way the service does:
 * this module ships as published JavaScript, and that package's client entry
 * carries the Cordis plugin graph. `brand-values.client.spec.ts` keeps the two
 * tables equal.
 */

/**
 * The built-in brand names, as `lyn-client-locale` declares them for a
 * deployment that renamed nothing. Specs run with no deployment brand on the
 * page, so these are the names their assertions read.
 */
const BUILT_IN_BRAND: Readonly<Record<string, string>> = {
  brandName: 'lyness',
  brandAbbr: 'LYN',
  brandNameZh: '领驭',
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
