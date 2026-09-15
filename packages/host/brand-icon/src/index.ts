/**
 * @lyness/lyn-host-brand-icon — turns a brand icon PNG into the single-colour
 * SVG icon and favicon a deployment serves.
 *
 * Every brand SVG a deployment serves is written by this toolchain rather than
 * accepted from anyone: the icon always arrives as a PNG, whether an operator
 * uploaded it or an image model drew it. The PNG is flattened onto white,
 * separated into ink and background by brightness, cropped to its ink, and
 * traced into paths. {@link isBrandSvg} confirms a document is exactly the form
 * these tools write before a caller stores it.
 * @module @lyness/lyn-host-brand-icon
 */

import * as vectorizer from '@neplex/vectorizer'

/** Smallest accepted side of the PNG, in pixels: below it tracing has too little detail to fit clean curves. */
export const ICON_MIN_SIDE = 1024

/** Largest accepted side of the PNG, in pixels, bounding the memory one decoded image takes. */
export const ICON_MAX_SIDE = 4096

/**
 * Narrowest accepted ink, as width over height.
 *
 * The sidebar sizes its mark by width inside a 24px-high row, so an icon taller
 * than it is wide overflows the row.
 */
export const ICON_MIN_ASPECT = 1

/**
 * Widest accepted ink, as width over height.
 *
 * The Web shell's own mark is 1.36:1; a wider icon crowds the product name set
 * beside it in the same row.
 */
export const ICON_MAX_ASPECT = 1.4

/**
 * Most separate shapes an icon may trace to.
 *
 * A mark legible as a 16px favicon is a few shapes; more means a photograph, a
 * texture, or noise, which no brand slot can show.
 */
export const ICON_MAX_PATHS = 64

/** Why a PNG could not become a brand icon. */
export type IconErrorCode =
  | 'NOT_PNG'
  | 'TOO_SMALL'
  | 'TOO_LARGE'
  | 'UNREADABLE_PNG'
  | 'NO_INK'
  | 'DARK_BACKGROUND'
  | 'TOO_TALL'
  | 'TOO_WIDE'
  | 'TOO_COMPLEX'

/** A PNG that cannot produce a usable brand icon. */
export class IconError extends Error {
  /** Stable reason, for callers that branch on the failure. */
  readonly code: IconErrorCode

  constructor(code: IconErrorCode, message: string) {
    super(`brand-icon: ${message}`)
    this.name = 'IconError'
    this.code = code
  }
}

/** The documents traced from one icon PNG. */
export interface BrandIcon {
  /** The icon: paths filled with `currentColor` in a box exactly the size of the ink, in source pixels. */
  readonly icon: string
  /** The favicon: the same paths centred on a square, black, and white under a dark colour scheme. */
  readonly favicon: string
  /** Width of the ink, in source pixels. */
  readonly width: number
  /** Height of the ink, in source pixels. */
  readonly height: number
  /** Width over height of the ink. */
  readonly aspect: number
  /** Number of separate shapes traced. */
  readonly paths: number
}

/** The PNG signature, then the length and type of the IHDR chunk every PNG opens with. */
const PNG_PREFIX = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82)

/** Brightness, after flattening onto white, below which a pixel is ink. */
const INK_BRIGHTNESS = 128

/** Blank pixels kept around the ink while tracing, so shapes touching its edge still close. */
const TRACE_MARGIN = 16

/**
 * Share of the favicon's side that the icon's longer edge spans.
 *
 * Matches the Web shell's own favicon, whose mark spans 96.6% of its canvas.
 */
const FAVICON_FILL = 0.96

/** Turns the favicon white under a dark colour scheme, where the browser's tab strip is dark. */
const FAVICON_STYLE = '@media (prefers-color-scheme: dark) { path { fill: #fff; } }'

/** One traced shape: its path data and the offset the tracer placed it at. */
const TRACED_PATH = /<path d="([^"]*)"[^>]*? transform="translate\(([-\d.e]+),([-\d.e]+)\)"/gu

/** A command letter or a number in path data. */
const PATH_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu

/**
 * Escape text for use as a literal inside a regular expression.
 * @param text - the literal.
 * @returns the escaped pattern.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

const NUMBER = String.raw`\d+(?:\.\d+)?`

/** Exactly the brand SVG forms these tools write: the icon, the favicon, and the wordmark. */
const BRAND_SVG = new RegExp(
  String.raw`^<svg xmlns="http://www\.w3\.org/2000/svg" width="(${NUMBER})" height="(${NUMBER})" `
    + String.raw`viewBox="0 0 \1 \2" fill="(?:currentColor|#000)">`
    + `(?:<style>${escapeRegExp(FAVICON_STYLE)}</style>)?`
    + String.raw`(?:<path d="[MLQCZ\d. -]+"/>)+</svg>$`,
  'u',
)

/** A decoded image reduced to which pixels are ink, and the rectangle the ink occupies. */
interface Ink {
  readonly mask: Uint8Array
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** One traced shape, positioned relative to the ink's top-left corner. */
interface Shape {
  readonly data: string
  readonly x: number
  readonly y: number
}

/**
 * Confirm a document is exactly a brand SVG these tools write.
 *
 * The check is a grammar of the output rather than a filter over arbitrary SVG:
 * a root element whose width and height match its view box, filled with
 * `currentColor` or black, an optional fixed dark-scheme rule, and one or more
 * paths whose data holds only move, line, curve, and close commands. Any other
 * element, attribute, comment, declaration, entity, or reference fails.
 * @param svg - the document.
 * @returns whether the document is an icon, favicon, or wordmark in the written form.
 */
export function isBrandSvg(svg: string): boolean {
  return BRAND_SVG.test(svg)
}

/**
 * Write a coordinate with two decimals and no negative zero.
 * @param value - the coordinate.
 * @returns its decimal text.
 */
function coordinate(value: number): string {
  // Adding zero turns a rounded negative zero into zero.
  return String(Math.round(value * 100) / 100 + 0)
}

/**
 * Read the image size from a PNG's header, before any pixel is decoded.
 * @param png - the file bytes.
 * @returns the declared width and height.
 * @throws {IconError} when the bytes do not open like a PNG.
 */
function readHeader(png: Uint8Array): { width: number; height: number } {
  if (!(PNG_PREFIX.every((byte, index) => png[index] === byte) && png.byteLength >= 24)) {
    throw new IconError('NOT_PNG', 'the file is not a PNG')
  }
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: header.getUint32(16), height: header.getUint32(20) }
}

/**
 * Decode a PNG whose header has already been checked.
 * @param png - the file bytes.
 * @returns the RGBA pixels.
 * @throws {IconError} when the pixel data cannot be decoded.
 */
function decode(png: Uint8Array): vectorizer.ImageData {
  try {
    return vectorizer.readImageSync(Buffer.from(png.buffer, png.byteOffset, png.byteLength))
  } catch (error) {
    throw new IconError('UNREADABLE_PNG', `the PNG could not be decoded: ${String(error)}`)
  }
}

/**
 * Separate ink from background and find the rectangle the ink occupies.
 * @param image - the decoded pixels.
 * @returns the ink mask and bounds.
 * @throws {IconError} when there is no ink, or the ink is a dark background.
 */
function findInk(image: vectorizer.ImageData): Ink {
  const { width, height, pixels } = image
  const mask = new Uint8Array(width * height)
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const alpha = Number(pixels[offset + 3]) / 255
      const brightness = 0.299 * Number(pixels[offset]) + 0.587 * Number(pixels[offset + 1]) + 0.114 * Number(pixels[offset + 2])
      // Flattened onto white, a transparent pixel is background whatever colour it stores.
      if (brightness * alpha + 255 * (1 - alpha) < INK_BRIGHTNESS) {
        mask[y * width + x] = 1
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  }
  if (right < 0) {
    throw new IconError('NO_INK', 'the image has no dark mark on a light background')
  }
  const corners = Number(mask[0]) + Number(mask[width - 1]) + Number(mask[(height - 1) * width]) + Number(mask[width * height - 1])
  if (corners === 4) {
    throw new IconError('DARK_BACKGROUND', 'all four corners are dark; supply a dark mark on a white or transparent background')
  }
  return { mask, left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * Trace the ink, cropped with a blank margin, into shapes.
 * @param imageWidth - width of the decoded image the mask indexes.
 * @param ink - the ink mask and bounds.
 * @returns the traced shapes, positioned relative to the ink.
 */
function trace(imageWidth: number, ink: Ink): Shape[] {
  const cropWidth = ink.width + 2 * TRACE_MARGIN
  const cropHeight = ink.height + 2 * TRACE_MARGIN
  const crop = Buffer.alloc(cropWidth * cropHeight * 4, 255)
  for (let y = 0; y < ink.height; y += 1) {
    for (let x = 0; x < ink.width; x += 1) {
      if (ink.mask[(y + ink.top) * imageWidth + x + ink.left] === 1) {
        const offset = ((y + TRACE_MARGIN) * cropWidth + x + TRACE_MARGIN) * 4
        crop.fill(0, offset, offset + 3)
      }
    }
  }
  const svg = vectorizer.vectorizeRawSync(crop, { width: cropWidth, height: cropHeight }, vectorizer.Preset.Bw)
  const shapes = [...svg.matchAll(TRACED_PATH)].map(match => ({
    data: String(match[1]),
    x: Number(match[2]) - TRACE_MARGIN,
    y: Number(match[3]) - TRACE_MARGIN,
  }))
  /* v8 ignore next -- the tracer writes a translate on every path; a path without one would be dropped silently. */
  if (shapes.length !== svg.split('<path').length - 1) {
    throw new Error('brand-icon: the tracer wrote a path this module cannot position')
  }
  return shapes
}

/**
 * Move path data by an offset and round its numbers.
 * @param data - path data holding absolute move, curve, and close commands.
 * @param dx - horizontal offset.
 * @param dy - vertical offset.
 * @returns the moved path data.
 */
function translatePath(data: string, dx: number, dy: number): string {
  let axis = 0
  const moved = data.replace(PATH_TOKEN, (token) => {
    if (/[A-Za-z]/u.test(token)) {
      /* v8 ignore next -- the tracer writes absolute moves, cubic curves, and closes only. */
      if (!'MCZ'.includes(token)) {
        throw new Error(`brand-icon: the tracer wrote path command ${token}, which this module cannot move`)
      }
      axis = 0
      return token
    }
    const value = Number(token) + (axis % 2 === 0 ? dx : dy)
    axis += 1
    return coordinate(value)
  })
  return moved.trim().replace(/\s+/gu, ' ')
}

/**
 * Write shapes as path elements moved by an offset.
 * @param shapes - the traced shapes.
 * @param dx - horizontal offset.
 * @param dy - vertical offset.
 * @returns the path elements.
 */
function pathElements(shapes: readonly Shape[], dx: number, dy: number): string {
  return shapes.map(shape => `<path d="${translatePath(shape.data, shape.x + dx, shape.y + dy)}"/>`).join('')
}

/**
 * Turn an icon PNG into the icon and favicon a deployment serves.
 *
 * The PNG is flattened onto white and every pixel darker than mid-grey is ink,
 * so colour is discarded: the mark comes out in one colour. The icon's box is
 * exactly the ink's size in source pixels, with no margin; the favicon centres
 * the same shapes on a square that the longer edge spans to
 * {@link FAVICON_FILL}.
 * @param png - the icon PNG's bytes.
 * @returns the two documents and the measured ink.
 * @throws {IconError} when the file is not a decodable PNG, its sides fall outside
 * {@link ICON_MIN_SIDE} to {@link ICON_MAX_SIDE}, it has no traceable ink or a dark
 * background, its ink is outside {@link ICON_MIN_ASPECT} to {@link ICON_MAX_ASPECT},
 * or it traces to more than {@link ICON_MAX_PATHS} shapes.
 */
export function vectorizeIcon(png: Uint8Array): BrandIcon {
  const size = readHeader(png)
  const declared = `${String(size.width)}×${String(size.height)}`
  if (Math.min(size.width, size.height) < ICON_MIN_SIDE) {
    throw new IconError('TOO_SMALL', `${declared} is smaller than ${String(ICON_MIN_SIDE)} pixels on a side`)
  }
  if (Math.max(size.width, size.height) > ICON_MAX_SIDE) {
    throw new IconError('TOO_LARGE', `${declared} is larger than ${String(ICON_MAX_SIDE)} pixels on a side`)
  }
  const image = decode(png)
  const ink = findInk(image)
  const aspect = ink.width / ink.height
  if (aspect < ICON_MIN_ASPECT) {
    throw new IconError('TOO_TALL', `the mark is ${coordinate(aspect)}:1, taller than it is wide`)
  }
  if (aspect > ICON_MAX_ASPECT) {
    throw new IconError('TOO_WIDE', `the mark is ${coordinate(aspect)}:1, wider than ${String(ICON_MAX_ASPECT)}:1`)
  }
  const shapes = trace(image.width, ink)
  if (shapes.length === 0) {
    throw new IconError('NO_INK', 'the mark is too small to trace')
  }
  if (shapes.length > ICON_MAX_PATHS) {
    throw new IconError('TOO_COMPLEX', `the mark traces to ${String(shapes.length)} shapes, more than ${String(ICON_MAX_PATHS)}`)
  }

  const width = String(ink.width)
  const height = String(ink.height)
  const side = Number(coordinate(Math.max(ink.width, ink.height) / FAVICON_FILL))
  const square = String(side)
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" `
    + `fill="currentColor">${pathElements(shapes, 0, 0)}</svg>`
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="${square}" height="${square}" viewBox="0 0 ${square} ${square}" `
    + `fill="#000"><style>${FAVICON_STYLE}</style>`
    + `${pathElements(shapes, (side - ink.width) / 2, (side - ink.height) / 2)}</svg>`
  /* v8 ignore next -- both documents are assembled above in the accepted form. */
  if (!isBrandSvg(icon) || !isBrandSvg(favicon)) {
    throw new Error('brand-icon: produced a document outside the brand SVG form')
  }
  return { icon, favicon, width: ink.width, height: ink.height, aspect, paths: shapes.length }
}
