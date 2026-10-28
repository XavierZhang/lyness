/**
 * Deployment overrides for the brand colour tokens this package owns.
 *
 * `lyn-brand-deployment` assigns the deployment's brand to a page global before
 * the client entry runs. The tokens live in this package's palette sheet, so
 * applying an override belongs here too — reading the global directly rather
 * than depending on the host package, which is how the other client readers of
 * that global work.
 *
 * The global is script-assigned page data, so every member is checked again
 * here. The host validates the same values at load; repeating it is not
 * redundant, because a value reaching `setProperty` is a value reaching the
 * stylesheet, and this side cannot see which host produced the page.
 */
import type { Context } from '@lyness/cordis'

/** `globalThis` property `lyn-brand-deployment` assigns before the client entry runs. */
const DEPLOYMENT_BRAND_GLOBAL = 'lynDeploymentBrand'

/**
 * Overridable token keys, and the custom property each one sets.
 *
 * Spelled out rather than derived so an unexpected key cannot reach CSS: the
 * map is the allowlist.
 */
const TOKEN_PROPERTIES: Readonly<Record<string, string>> = {
  black: '--lyness-black',
  blue: '--lyness-blue',
  blueDark: '--lyness-blue-dark',
  cyan: '--lyness-cyan',
  white: '--lyness-white',
  gray50: '--lyness-gray-50',
  gray200: '--lyness-gray-200',
  gray600: '--lyness-gray-600',
  gray900: '--lyness-gray-900',
  success: '--lyness-success',
  warning: '--lyness-warning',
  error: '--lyness-error',
  info: '--lyness-info',
}

/**
 * Colours a deployment may name.
 *
 * The same shape the host accepts: a hex colour or a colour keyword. Anything
 * else is refused rather than passed to `setProperty`, where a declaration the
 * browser cannot parse would be dropped silently and a crafted one would not.
 */
const BRAND_COLOUR = /^(?:#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|[a-z]{3,20})$/iu

/**
 * Read the usable colour overrides the page carries.
 * @returns property/value pairs for the tokens this deployment replaced; empty
 * when the page carries no brand, no colours, or none that pass the check.
 */
export function readDeploymentColours(): readonly (readonly [string, string])[] {
  const brand: unknown = Reflect.get(globalThis, DEPLOYMENT_BRAND_GLOBAL)
  if (typeof brand !== 'object' || brand === null) return []
  const colors: unknown = Reflect.get(brand, 'colors')
  if (typeof colors !== 'object' || colors === null) return []
  const applied: (readonly [string, string])[] = []
  for (const [token, property] of Object.entries(TOKEN_PROPERTIES)) {
    const value: unknown = Reflect.get(colors, token)
    if (typeof value === 'string' && BRAND_COLOUR.test(value)) applied.push([property, value])
  }
  return applied
}

/**
 * Apply the deployment's colour overrides for exactly the owning plugin lifetime.
 *
 * They are set on the document element, which outranks the `:root` declarations
 * in the palette sheet without editing it, and are removed on dispose so an
 * unloaded brand plugin leaves the built-in palette behind.
 * @param ctx - Owning plugin context.
 */
export function installDeploymentColours(ctx: Context): void {
  if (typeof document === 'undefined') return
  const applied = readDeploymentColours()
  if (applied.length === 0) return
  ctx.effect(() => {
    const style = document.documentElement.style
    for (const [property, value] of applied) style.setProperty(property, value)
    return () => {
      for (const [property] of applied) style.removeProperty(property)
    }
  }, 'ui-theme: deployment colour overrides')
}
