/**
 * The brand-studio run: trace the icon PNG, typeset the product name, write the
 * three brand SVGs, then point one profile's `brand-deployment` row at them.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument, YAMLMap, YAMLSeq } from 'yaml'
import type { Document } from 'yaml'
import { initProfile, PROFILE_PATCH_FILENAME, PROFILE_TEMPLATES, resolveProfileDir } from '@lyness/lyn-app-boot'
import { writeFileAtomic } from '@lyness/lyn-atomic-write'
import { isBrandColour } from '@lyness/lyn-host-brand-deployment'
import { loadBrandFonts } from '@lyness/lyn-host-brand-fonts'
import { isBrandSvg, vectorizeIcon } from '@lyness/lyn-host-brand-icon'
import { typesetWordmark } from '@lyness/lyn-host-brand-wordmark'

/** Loader id of the row the Web application bundle mounts for the deployment brand. */
export const BRAND_ROW_ID = 'brand-deployment'

/** Package the brand row loads; the Loader skips a patch that names a different package. */
export const BRAND_PACKAGE = '@lyness/lyn-host-brand-deployment'

/** File each generated SVG is written to inside the asset directory, by `brand-deployment` role. */
export const ASSET_FILES = {
  mark: 'mark.svg',
  wordmark: 'wordmark.svg',
  favicon: 'favicon.svg',
} as const

/** One `brand-deployment` asset role. */
type AssetRole = keyof typeof ASSET_FILES

const ASSET_ROLES: readonly AssetRole[] = ['mark', 'wordmark', 'favicon']

/** One brand-studio run, with every path absolute. */
export interface StudioRequest {
  /** Product name: the wordmark text and the deployment's `productName`. */
  readonly productName: string
  /** Icon PNG to trace. */
  readonly iconPath: string
  /** The brand owner's font file, or undefined to set the name in the platform's built-in fonts. */
  readonly fontPath: string | undefined
  /** Brand colour, or undefined to keep the colour the row already names. */
  readonly themeColor: string | undefined
  /** Directory receiving the generated SVGs. */
  readonly assetDirectory: string
  /** Patch layer receiving the brand row. */
  readonly patchPath: string
}

/** What a finished run wrote. */
export interface StudioResult {
  /** Absolute path of each written SVG, by role. */
  readonly assets: Readonly<Record<AssetRole, string>>
  /** Traced icon width over height. */
  readonly iconAspect: number
  /** Wordmark width over height. */
  readonly wordmarkAspect: number
}

/** A run refused because of what the operator supplied; the message is written for the operator. */
export class StudioError extends Error {
  override name = 'StudioError'
}

/**
 * Point every `brand-deployment` row of a patch layer at a brand, adding the
 * row when the layer has none. Config keys the studio does not own, such as
 * `showPoweredBy`, other rows, comments, and `!!js` values stay as written.
 * @param layer - current patch-layer text; empty when the file does not exist.
 * @param fields - config keys to set on the row.
 * @returns the new patch-layer text.
 * @throws {StudioError} when the layer is not a YAML array.
 */
export function upsertBrandRow(layer: string, fields: Readonly<Record<string, string>>): string {
  const document: Document = parseDocument(layer)
  const [error] = document.errors
  if (error !== undefined) throw new StudioError(`the patch layer is not valid YAML: ${error.message}`)
  const rows = document.contents ?? new YAMLSeq()
  if (!isSeq(rows)) throw new StudioError('the patch layer must be a top-level YAML array of rows')
  document.contents = rows
  rows.flow = false
  const targets = rows.items.filter((row): row is YAMLMap => isMap(row) && row.get('id') === BRAND_ROW_ID)
  if (targets.length === 0) {
    const row = new YAMLMap()
    row.set('id', BRAND_ROW_ID)
    rows.items.push(row)
    targets.push(row)
  }
  for (const row of targets) {
    row.set('name', BRAND_PACKAGE)
    const existing = row.get('config', true)
    const config = isMap(existing) ? existing : new YAMLMap()
    for (const [key, value] of Object.entries(fields)) config.set(key, value)
    row.set('config', config)
  }
  return document.toString()
}

/**
 * Locate a profile's patch layer, initializing a shipped profile that has never
 * launched exactly as its first launch would.
 * @param profile - profile name.
 * @param home - lyn home directory.
 * @returns the absolute patch-layer path.
 * @throws {StudioError} when the profile neither exists nor is shipped.
 */
export function resolveProfilePatch(profile: string, home: string): string {
  const dir = resolveProfileDir(profile, home)
  if (!existsSync(join(dir, 'package.json'))) {
    const template = PROFILE_TEMPLATES[profile]
    if (template === undefined) {
      throw new StudioError(`profile ${JSON.stringify(profile)} does not exist; launch it once or name a shipped profile`)
    }
    initProfile(dir, template.bundles, template.patchReload)
  }
  return join(dir, PROFILE_PATCH_FILENAME)
}

async function readLayer(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    // A layer the profile has not written yet is created by this run; any other failure is the operator's to see.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}

/**
 * Generate a brand and apply it. Inputs are validated and the new patch layer is
 * composed before anything is written, and the SVGs are written before the
 * layer, so a profile that reloads its layer on change never reads a row that
 * names a file not yet on disk.
 * @param request - the run's inputs.
 * @returns what the run wrote.
 * @throws {StudioError} for an unusable colour or patch layer.
 * @throws {import('@lyness/lyn-host-brand-icon').IconError} for an icon that cannot be traced.
 * @throws {import('@lyness/lyn-host-brand-wordmark').WordmarkError} for a name the font cannot typeset.
 */
export async function runStudio(request: StudioRequest): Promise<StudioResult> {
  if (request.themeColor !== undefined && !isBrandColour(request.themeColor)) {
    throw new StudioError(`theme colour must be a hex colour or a colour keyword; got ${JSON.stringify(request.themeColor)}`)
  }
  const icon = vectorizeIcon(new Uint8Array(await readFile(request.iconPath)))
  const fonts: readonly [Uint8Array, ...Uint8Array[]] = request.fontPath === undefined
    ? loadBrandFonts()
    : [new Uint8Array(await readFile(request.fontPath))]
  const wordmark = typesetWordmark(request.productName, fonts)
  const svgs: Record<AssetRole, string> = { mark: icon.icon, wordmark: wordmark.svg, favicon: icon.favicon }
  for (const role of ASSET_ROLES) {
    if (!isBrandSvg(svgs[role])) throw new Error(`brand-studio: the generated ${role} is not a brand SVG`)
  }
  const layer = upsertBrandRow(await readLayer(request.patchPath), {
    productName: request.productName,
    ...request.themeColor === undefined ? {} : { themeColor: request.themeColor },
    assetDirectory: request.assetDirectory,
    ...ASSET_FILES,
  })

  const assets: Record<AssetRole, string> = {
    mark: join(request.assetDirectory, ASSET_FILES.mark),
    wordmark: join(request.assetDirectory, ASSET_FILES.wordmark),
    favicon: join(request.assetDirectory, ASSET_FILES.favicon),
  }
  for (const role of ASSET_ROLES) await writeFileAtomic(assets[role], svgs[role], { mode: 0o644 })
  await writeFileAtomic(request.patchPath, layer, { mode: 0o644 })
  return { assets, iconAspect: icon.aspect, wordmarkAspect: wordmark.aspect }
}
