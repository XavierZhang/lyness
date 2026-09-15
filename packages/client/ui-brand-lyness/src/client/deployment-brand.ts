/** Reader for the deployment brand a served page carries ahead of client boot. */

/** `globalThis` property `lyn-brand-deployment` assigns before the client entry runs. */
export const DEPLOYMENT_BRAND_GLOBAL = 'lynDeploymentBrand'

/** Brand members this package presents; an absent member keeps the lyness artwork. */
export interface DeploymentBrandMembers {
  /** Product name shown as text when the deployment has no wordmark. */
  readonly productName?: string | undefined
  /** Same-origin path of the deployment mark. */
  readonly markUrl?: string | undefined
  /** Same-origin path of the deployment wordmark. */
  readonly wordmarkUrl?: string | undefined
}

/** A path on the page's own origin: one leading slash, not a protocol-relative `//` or `/\`. */
const SAME_ORIGIN_PATH = /^\/(?![/\\])/u

function text(brand: object, key: string): string | undefined {
  const value: unknown = Reflect.get(brand, key)
  return typeof value === 'string' && value !== '' ? value : undefined
}

function sameOriginPath(brand: object, key: string): string | undefined {
  const value = text(brand, key)
  return value !== undefined && SAME_ORIGIN_PATH.test(value) ? value : undefined
}

/**
 * Read the deployment brand from the page global. The value arrives as
 * script-assigned page data, so each member is checked and an unusable member
 * reads as absent.
 * @returns the usable members; none when the page carries no brand object.
 */
export function readDeploymentBrand(): DeploymentBrandMembers {
  const brand: unknown = Reflect.get(globalThis, DEPLOYMENT_BRAND_GLOBAL)
  if (typeof brand !== 'object' || brand === null) return {}
  return {
    productName: text(brand, 'productName'),
    markUrl: sameOriginPath(brand, 'markUrl'),
    wordmarkUrl: sameOriginPath(brand, 'wordmarkUrl'),
  }
}
