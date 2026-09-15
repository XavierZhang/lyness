/**
 * @lyness/lyn-host-brand-deployment — the deployment's own brand over the
 * webserver's index render.
 *
 * A deployment owns its visual identity: the browser tab title, the favicon,
 * the browser-chrome theme colour, and the mark and wordmark the served page
 * draws. Those are composition config here rather than user settings, because
 * user settings outrank composition and a deployment must pin its identity
 * against the people using it; this plugin registers no settings section, so
 * nothing below the composing application can reach these values.
 *
 * They are also served rather than built in. Upstream embeds its own brand at
 * build time through the `LYNESS_CLIENT_*` prefix, which requires rebuilding
 * the frontend per brand. Everything here is applied to each index response,
 * so changing a patch layer and restarting is the whole operation.
 *
 * Assets are files the deployment places, never uploads: there is no intake
 * route, no server-side format check, and no path a request contributes to a
 * filesystem read — one fixed table maps a request to a configured file.
 * @module @lyness/lyn-host-brand-deployment
 */

import { readFile } from 'node:fs/promises'
import { statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, isAbsolute, join } from 'node:path'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'brand-deployment'

/** Services required before the brand can reach an index response. */
export const inject = ['webServer']

/** Route prefix the configured asset files are served under. */
export const BRAND_ASSET_ROUTE = '/brand'

/** `globalThis` property a served page reads its deployment brand from. */
export const DEPLOYMENT_BRAND_GLOBAL = 'lynDeploymentBrand'

/**
 * What a served page can read about this deployment's brand.
 *
 * Absent members mean the deployment configured nothing and the page keeps its
 * built-in presentation, which is what an unbranded development build shows.
 */
export interface DeploymentBrand {
  /** Product name for page and in-app presentation, or undefined to keep the built-in one. */
  readonly productName?: string | undefined
  /** Brand colour for browser chrome and accents, or undefined to keep the built-in one. */
  readonly themeColor?: string | undefined
  /** URL of the deployment's mark, or undefined to keep the built-in one. */
  readonly markUrl?: string | undefined
  /** URL of the deployment's wordmark, or undefined to keep the built-in one. */
  readonly wordmarkUrl?: string | undefined
  /** Whether the page shows the upstream attribution line. */
  readonly showPoweredBy: boolean
}

/** Plugin config: the deployment's brand, as an operator writes it. */
export interface Config {
  /** Product name shown in the browser tab and in-app; omit to keep the built-in one. */
  productName?: string
  /** Brand colour as a hex triplet or a CSS colour keyword. */
  themeColor?: string
  /** Absolute directory holding the files named below. */
  assetDirectory?: string
  /** Favicon file name inside `assetDirectory`. */
  favicon?: string
  /** Mark (icon) file name inside `assetDirectory`. */
  mark?: string
  /** Wordmark file name inside `assetDirectory`. */
  wordmark?: string
  /** Whether the served page shows the upstream attribution line. @default false */
  showPoweredBy?: boolean
}

/** Config after the schema has applied its defaults. */
interface ResolvedConfig extends Config {
  showPoweredBy: boolean
}

export const Config: z<Config> = z.object({
  productName: z.string(),
  themeColor: z.string(),
  assetDirectory: z.string(),
  favicon: z.string(),
  mark: z.string(),
  wordmark: z.string(),
  showPoweredBy: z.boolean().default(false),
})

/**
 * Colours a deployment may name.
 *
 * Narrow on purpose: the value reaches an HTML attribute and a stylesheet, and
 * a hex triplet or a keyword covers a brand colour. Escaping already prevents
 * markup from escaping the attribute; refusing the rest at load means an
 * operator learns about a typo when the deployment starts rather than from a
 * page that renders with no colour.
 */
const BRAND_COLOUR = /^(?:#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|[a-z]{3,20})$/iu

/**
 * Whether a deployment may name this colour as its `themeColor`.
 * @param colour - the configured value.
 * @returns true for a hex colour or a colour keyword.
 */
export function isBrandColour(colour: string): boolean {
  return BRAND_COLOUR.test(colour)
}

/** Asset roles a deployment may place, in the order the page consumes them. */
const ASSET_ROLES = ['favicon', 'mark', 'wordmark'] as const

/** One asset role a deployment configured. */
type AssetRole = (typeof ASSET_ROLES)[number]

const MIME: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

/** One configured asset: where its bytes are and how it is addressed. */
interface Asset {
  /** Absolute path of the file the deployment placed. */
  readonly file: string
  /** Site-root URL the page requests it by. */
  readonly url: string
  /** Content type served for it. */
  readonly mime: string
}

/**
 * Escape a value placed in a quoted HTML attribute.
 * @param value - the raw attribute value.
 * @returns the value with attribute-significant characters replaced.
 */
function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * Escape a value placed in HTML text.
 * @param value - the raw text.
 * @returns the text with markup-significant characters replaced.
 */
function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * Resolve the asset table, failing the load on anything an operator got wrong.
 *
 * Every check is self-contained, so it runs here rather than on the first
 * request: a deployment that names a missing file must not start and serve a
 * page whose brand silently fell back.
 * @param config - the validated plugin config.
 * @returns the configured assets by role.
 * @throws {Error} when a named asset has no directory, no file, or an unserveable type.
 */
function resolveAssets(config: Config): ReadonlyMap<AssetRole, Asset> {
  const assets = new Map<AssetRole, Asset>()
  const named = ASSET_ROLES.flatMap((role) => {
    const fileName = config[role]
    return fileName === undefined ? [] : [{ role, fileName }]
  })
  if (named.length === 0) return assets
  const directory = config.assetDirectory
  if (directory === undefined) {
    throw new Error(`brand-deployment: ${named.map(entry => entry.role).join(', ')} named without assetDirectory`)
  }
  if (!isAbsolute(directory)) {
    throw new Error(`brand-deployment: assetDirectory must be absolute; got ${JSON.stringify(directory)}`)
  }
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`brand-deployment: assetDirectory ${JSON.stringify(directory)} is not a directory`)
  }
  for (const { role, fileName } of named) {
    const file = join(directory, fileName)
    if (!file.startsWith(`${directory}/`) && !file.startsWith(`${directory}\\`)) {
      throw new Error(`brand-deployment: ${role} ${JSON.stringify(fileName)} leaves assetDirectory`)
    }
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`brand-deployment: ${role} ${JSON.stringify(file)} is not a readable file`)
    }
    const extension = extname(fileName).toLowerCase()
    const mime = MIME[extension]
    if (mime === undefined) {
      throw new Error(`brand-deployment: ${role} ${JSON.stringify(fileName)} has no serveable image type`)
    }
    assets.set(role, { file, url: `${BRAND_ASSET_ROUTE}/${role}${extension}`, mime })
  }
  return assets
}

/**
 * Rewrite the index head for one response.
 *
 * The title and the favicon are replacements, not additions: the shipped
 * index already declares both, a second `<title>` is ignored, and a second
 * icon link is resolved by the browser rather than by this deployment.
 * @param brand - the resolved deployment brand.
 * @param faviconUrl - URL of the configured favicon, when there is one.
 * @returns an html-to-html transform for `tapIndex`.
 */
function indexTransform(
  brand: DeploymentBrand,
  faviconUrl: string | undefined,
): (html: string) => string {
  return (html) => {
    let out = html
    const productName = brand.productName
    if (productName !== undefined) {
      const title = `<title>${escapeText(productName)}</title>`
      out = /<title>[\s\S]*?<\/title>/iu.test(out)
        ? out.replace(/<title>[\s\S]*?<\/title>/iu, title)
        : out.replace(/<head(\s[^>]*)?>/iu, match => `${match}${title}`)
    }
    if (faviconUrl !== undefined) {
      const link = `<link rel="icon" href="${escapeAttribute(faviconUrl)}" />`
      out = /<link\b[^>]*\brel=(["'])icon\1[^>]*>/iu.test(out)
        ? out.replace(/<link\b[^>]*\brel=(["'])icon\1[^>]*>/iu, link)
        : out.replace(/<head(\s[^>]*)?>/iu, match => `${match}${link}`)
    }
    return out
  }
}

/**
 * Serve one configured asset, or 404 for a path naming no role.
 * @param assets - the resolved asset table.
 * @returns a webserver route handler over the fixed table.
 */
function assetHandler(assets: ReadonlyMap<AssetRole, Asset>) {
  const byUrl = new Map([...assets.values()].map(asset => [asset.url, asset]))
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    // The request contributes no path segment to a filesystem read: its
    // pathname either names a configured role exactly or it is a miss.
    const asset = byUrl.get(new URL(String(req.url), 'http://localhost').pathname)
    if (asset === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    let body: Buffer
    try {
      body = await readFile(asset.file)
    } catch {
      // Swallows only the read of a file this plugin proved present at load.
      // A deployment that deleted it mid-run gets a miss, not a crashed server.
      res.writeHead(404)
      res.end()
      return
    }
    // Revalidated rather than cached: the URL is stable across deployments, so
    // a redeploy that changes the bytes must not keep serving the old ones.
    res.writeHead(200, { 'content-type': asset.mime, 'cache-control': 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : body)
  }
}

/**
 * Mount the deployment's brand: serve its assets and apply it to every index.
 * @param ctx - the host context.
 * @param config - the validated plugin config.
 * @throws {Error} when a configured colour or asset is unusable.
 */
export function apply(ctx: Context, config: Config): void {
  if (config.themeColor !== undefined && !isBrandColour(config.themeColor)) {
    throw new Error(
      `brand-deployment: themeColor must be a hex triplet or a colour keyword; got ${JSON.stringify(config.themeColor)}`,
    )
  }
  const assets = resolveAssets(config)
  // The schema applied its defaults before apply ran, so the optional-input
  // fields are present here; the cast records that once rather than defaulting
  // a second time behind the schema's back.
  const resolved = config as ResolvedConfig
  const brand: DeploymentBrand = {
    productName: resolved.productName,
    themeColor: resolved.themeColor,
    markUrl: assets.get('mark')?.url,
    wordmarkUrl: assets.get('wordmark')?.url,
    showPoweredBy: resolved.showPoweredBy,
  }

  if (assets.size > 0) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: BRAND_ASSET_ROUTE,
      handler: assetHandler(assets),
    }))
  }

  // Rows, not taps, for everything a row can express: the same table feeds the
  // served HTML and a static worker's boot payload, and a tap reaches only the
  // first. The title and the icon link are replacements, which no row can be.
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: DEPLOYMENT_BRAND_GLOBAL, value: brand })
    if (brand.themeColor !== undefined) {
      table.push({
        kind: 'html',
        placement: 'head',
        html: `<meta name="theme-color" content="${escapeAttribute(brand.themeColor)}" />`,
      })
    }
  })
  ctx.effect(() => ctx.webServer.tapIndex(indexTransform(brand, assets.get('favicon')?.url)))
}
