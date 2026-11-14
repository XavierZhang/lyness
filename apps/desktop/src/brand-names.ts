/**
 * The product names a build that packaged none shows.
 *
 * The shell's copy writes the product's name as a placeholder, and these fill it
 * for the official build and for every unpackaged launch. They live apart from
 * the dictionaries so no dictionary carries a literal product name, and apart
 * from `brand.ts` so the copy a renderer resolves can reach them: that module
 * reads process arguments, which the Client compiler face does not admit.
 */

/** Every placeholder the shell's copy writes, with the name that fills it. */
export const BUILT_IN_BRAND: Readonly<Record<string, string>> = {
  brandName: 'lyness',
  brandAbbr: 'LYN',
  brandNameZh: '领驭',
}
