/**
 * Brand names every dictionary may name through a placeholder.
 *
 * Product copy says the product's name in three shapes, and a private
 * deployment replaces the ones it owns. Writing the name into each string would
 * make a rebranded deployment read as lyness in every sentence the operator did
 * not think to look at, so the dictionaries carry placeholders and these values
 * fill them.
 *
 * `lyn-brand-deployment` publishes the deployment's names on a page global, the
 * same one the palette overrides arrive on. The global is script-assigned page
 * data, so each member is checked here: a member that is not a usable string
 * reads as absent.
 */

/** `globalThis` property `lyn-brand-deployment` assigns before the client entry runs. */
const DEPLOYMENT_BRAND_GLOBAL = 'lynDeploymentBrand'

/** The built-in names, standing together for a deployment that renamed nothing. */
const BUILT_IN: Readonly<Record<string, string>> = {
  brandName: 'lyness',
  brandAbbr: 'LYN',
  brandNameZh: '领驭',
}

/**
 * A name a deployment may carry: one line, no placeholder syntax of its own.
 *
 * A value reaching a template must not reopen substitution or carry a line
 * break into a sentence, and a name long enough to be prose is a
 * misconfiguration rather than a brand.
 */
const BRAND_NAME = /^[^\n\r{}]{1,64}$/u

/**
 * Read the brand names this page's copy should use.
 *
 * The three names resolve as one set. A deployment that carries any of them
 * carries the others from the one it did name, because a deployment named Acme
 * must never read as `LYN` in the sentences it left to the abbreviation, or as
 * 领驭 in its Chinese copy. The built-in names stand only where the page names
 * no brand at all.
 * @returns every placeholder name with the value that fills it.
 */
export function readBrandValues(): Readonly<Record<string, string>> {
  const brand: unknown = Reflect.get(globalThis, DEPLOYMENT_BRAND_GLOBAL)
  if (typeof brand !== 'object' || brand === null) return BUILT_IN
  const carried = {
    brandName: usableName(brand, 'productName'),
    brandAbbr: usableName(brand, 'productAbbreviation'),
    brandNameZh: usableName(brand, 'productNameZh'),
  }
  const named = carried.brandName ?? carried.brandAbbr ?? carried.brandNameZh
  if (named === undefined) return BUILT_IN
  return {
    brandName: carried.brandName ?? named,
    brandAbbr: carried.brandAbbr ?? named,
    brandNameZh: carried.brandNameZh ?? named,
  }
}

/**
 * Read one brand member from the page global.
 * @param brand - the deployment brand object the page carries.
 * @param member - member name `lyn-brand-deployment` publishes.
 * @returns the name, or undefined when the member is absent or unusable.
 */
function usableName(brand: object, member: string): string | undefined {
  const value: unknown = Reflect.get(brand, member)
  return typeof value === 'string' && BRAND_NAME.test(value) ? value : undefined
}
