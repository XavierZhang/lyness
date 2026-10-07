/**
 * What the setup page sends and receives.
 *
 * The page is untrusted input even behind the token: it is a browser document,
 * so everything it posts is parsed and checked here before it reaches
 * `runStudio`, which owns the brand rules themselves.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument } from 'yaml'
import { BRAND_COLOUR_TOKENS } from '@lyness/lyn-host-brand-deployment'
import { BRAND_ROW_ID, runStudio, type StudioResult } from '@lyness/lyn-brand-studio'

/**
 * Row config the page reads back, by key.
 *
 * Named rather than enumerated so a key the studio does not own — `showPoweredBy`,
 * or anything an operator added by hand — never reaches the page as a text field
 * it would write back as a string.
 */
const BRAND_FIELDS = ['productName', 'productAbbreviation', 'productNameZh', 'themeColor'] as const

/** Largest icon this page accepts, before base64 expansion. */
export const MAXIMUM_ICON_BYTES = 12 * 1024 * 1024

/** The brand a profile's patch layer currently names. */
export interface CurrentBrand {
  /** Config values the brand row carries, by key; absent keys are absent here. */
  readonly config: Readonly<Record<string, string>>
  /** Palette tokens the row replaces, by token key. */
  readonly colors: Readonly<Record<string, string>>
}

/** One submitted brand, after parsing and before `runStudio` checks it. */
export interface SubmittedBrand {
  /** Product name, which is also the wordmark text. */
  readonly productName: string
  /** Short form, or undefined to abbreviate to the product name. */
  readonly productAbbreviation: string | undefined
  /** Chinese product name, or undefined to use the product name. */
  readonly productNameZh: string | undefined
  /** Browser-chrome colour, or undefined to keep the row's. */
  readonly themeColor: string | undefined
  /** Palette tokens to replace, by token key. */
  readonly colors: Readonly<Record<string, string>>
  /** The icon PNG bytes. */
  readonly icon: Uint8Array
}

/** A submission the page got wrong; the message is written for the operator. */
export class SubmissionError extends Error {
  override name = 'SubmissionError'
}

/**
 * Read one string member of a parsed JSON object.
 * @param body - the parsed request body.
 * @param key - member name.
 * @returns the string, or undefined when the member is absent or not a string.
 */
function optionalText(body: object, key: string): string | undefined {
  const value: unknown = Reflect.get(body, key)
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new SubmissionError(`${key} must be text`)
  return value
}

/**
 * Read the palette tokens a submission names.
 * @param body - the parsed request body.
 * @returns the named tokens; empty when the submission names none.
 * @throws {SubmissionError} when the map or one of its values is not text.
 */
function submittedColours(body: object): Record<string, string> {
  const value: unknown = Reflect.get(body, 'colors')
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object') throw new SubmissionError('colors must be an object')
  const colors: Record<string, string> = {}
  for (const token of BRAND_COLOUR_TOKENS) {
    const colour: unknown = Reflect.get(value, token)
    if (colour === undefined || colour === null || colour === '') continue
    if (typeof colour !== 'string') throw new SubmissionError(`colors.${token} must be text`)
    colors[token] = colour
  }
  return colors
}

/**
 * Parse one submitted brand.
 *
 * The icon arrives base64-encoded because the page posts JSON; `runStudio`
 * refuses anything that is not a usable PNG, so only the decoding is checked
 * here.
 * @param text - the request body.
 * @returns the submission.
 * @throws {SubmissionError} for a body this page could not have produced.
 */
export function parseSubmission(text: string): SubmittedBrand {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch (error) {
    throw new SubmissionError(`the request body is not JSON: ${String(error)}`)
  }
  if (typeof body !== 'object' || body === null) throw new SubmissionError('the request body must be an object')
  if (Reflect.get(body, 'acceptTrademark') !== true) {
    throw new SubmissionError('confirm that the name and the icon infringe no trademark')
  }
  const productName = optionalText(body, 'productName')
  if (productName === undefined) throw new SubmissionError('productName is required')
  const icon = optionalText(body, 'icon')
  if (icon === undefined) throw new SubmissionError('an icon PNG is required')
  const bytes = Buffer.from(icon, 'base64')
  if (bytes.length === 0) throw new SubmissionError('the icon did not decode as base64')
  return {
    productName,
    productAbbreviation: optionalText(body, 'productAbbreviation'),
    productNameZh: optionalText(body, 'productNameZh'),
    themeColor: optionalText(body, 'themeColor'),
    colors: submittedColours(body),
    icon: new Uint8Array(bytes),
  }
}

/**
 * Read the brand a patch layer already names.
 *
 * A layer this cannot read reads as no brand: the page then opens on the
 * built-in values, and applying rewrites the row the way the studio does.
 * @param layer - the patch-layer text, or empty when the file does not exist.
 * @returns the row's string config values and its palette tokens.
 */
export function readCurrentBrand(layer: string): CurrentBrand {
  const config: Record<string, string> = {}
  const colors: Record<string, string> = {}
  const document = parseDocument(layer)
  const rows = document.contents
  if (document.errors.length > 0 || !isSeq(rows)) return { config, colors }
  for (const row of rows.items) {
    if (!isMap(row) || String(row.get('id')) !== BRAND_ROW_ID) continue
    const entries = row.get('config', true)
    if (!isMap(entries)) continue
    for (const field of BRAND_FIELDS) {
      const value: unknown = entries.get(field)
      if (typeof value === 'string') config[field] = value
    }
    const palette = entries.get('colors', true)
    if (!isMap(palette)) continue
    for (const token of BRAND_COLOUR_TOKENS) {
      const colour: unknown = palette.get(token)
      if (typeof colour === 'string') colors[token] = colour
    }
  }
  return { config, colors }
}

/**
 * Apply one submission, writing the artwork and the brand row.
 *
 * `runStudio` reads the icon from a file, so the uploaded bytes land in a
 * private temporary directory for the length of the run and are removed with
 * it, whether the run succeeded or not.
 * @param submitted - the parsed submission.
 * @param assetDirectory - absolute directory receiving the generated SVGs.
 * @param patchPath - absolute patch layer receiving the brand row.
 * @returns what the run wrote.
 */
export async function applySubmission(
  submitted: SubmittedBrand,
  assetDirectory: string,
  patchPath: string,
): Promise<StudioResult> {
  const scratch = await mkdtemp(join(tmpdir(), 'lyn-brand-setup-'))
  try {
    const iconPath = join(scratch, 'icon.png')
    await writeFile(iconPath, submitted.icon, { mode: 0o600 })
    return await runStudio({
      productName: submitted.productName,
      productAbbreviation: submitted.productAbbreviation,
      productNameZh: submitted.productNameZh,
      colors: submitted.colors,
      iconPath,
      fontPath: undefined,
      themeColor: submitted.themeColor,
      assetDirectory,
      patchPath,
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
