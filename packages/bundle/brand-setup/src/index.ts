/**
 * The brand-setup profile: a loopback page one operator brands a deployment
 * from, in place of hand-writing the `brand-deployment` row.
 *
 * The page writes a profile's patch layer, which outranks every user setting,
 * so reaching it must mean standing where the server runs. Two things enforce
 * that together: the server binds the loopback interface, and every route
 * requires the token this process prints to its own terminal and keeps only in
 * memory. The token dies with the process; there is no stored credential and no
 * second way in.
 * @module @lyness/lyn-brand-setup
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
// The Context merge (ctx.webServer) arrives with the reply helper.
import { sendJson } from '@lyness/lyn-host-webserver'
import { internals } from '@lyness/lyn-cmdline'
import { lynHomePath, resolveLynHome } from '@lyness/lyn-home-paths'
import { resolveProfilePatch, StudioError } from '@lyness/lyn-brand-studio'
import { applySubmission, MAXIMUM_ICON_BYTES, parseSubmission, readCurrentBrand, SubmissionError } from './brand-request.ts'
import { renderSetupPage } from './page.ts'
import { createSerialiser } from './serialise.ts'

export { MAXIMUM_ICON_BYTES, parseSubmission, readCurrentBrand, SubmissionError } from './brand-request.ts'
export { renderSetupPage } from './page.ts'
export { createSerialiser, type Serialiser } from './serialise.ts'

/** Stable Cordis plugin name. */
export const name = 'brand-setup'

/** Required service: the loopback HTTP server this page is served from. */
export const inject = ['webServer']

/** Header the page sends its token in, so the token never rides a later URL. */
export const TOKEN_HEADER = 'x-lyn-setup-token'

/** Largest request body this page can produce: a base64 icon plus its fields. */
const MAXIMUM_BODY_BYTES = Math.ceil(MAXIMUM_ICON_BYTES * 4 / 3) + 8 * 1024

/** Plugin config: where the brand this page writes lands. */
export interface Config {
  /** Profile whose patch layer receives the brand row. */
  target?: string
  /** Absolute directory receiving the generated SVGs; omit for `$LYNESS_HOME/brand`. */
  assetDirectory?: string
}

/** Config after the schema has applied its defaults. */
interface ResolvedConfig extends Config {
  target: string
}

export const Config: z<Config> = z.object({
  target: z.string().default('web'),
  assetDirectory: z.string(),
})

/**
 * The directory the generated SVGs land in.
 *
 * The default depends on the home this process resolved, which the schema
 * cannot know when it parses, so the defaulting happens here rather than as a
 * schema default frozen at import.
 * @param configured - the configured directory, if any.
 * @returns the absolute directory.
 */
function resolveAssetDirectory(configured: string | undefined): string {
  return configured ?? lynHomePath('brand')
}

/**
 * Whether a request carries this run's token.
 *
 * The comparison is constant-time and length-checked first, because
 * `timingSafeEqual` throws on a length mismatch.
 * @param carried - the token the request carried, if any.
 * @param token - this run's token.
 * @returns true when they are the same token.
 */
function carriesToken(carried: string | undefined, token: string): boolean {
  if (carried === undefined) return false
  const offered = Buffer.from(carried)
  const expected = Buffer.from(token)
  return offered.length === expected.length && timingSafeEqual(offered, expected)
}

/**
 * Read a request body, refusing one past the size this page can produce.
 * @param req - the request.
 * @returns the body text.
 * @throws {SubmissionError} when the body exceeds the limit.
 */
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAXIMUM_BODY_BYTES) throw new SubmissionError('the icon is larger than this page accepts')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Serve the brand-setup page and the two routes it calls.
 * @param ctx - plugin context carrying the loopback server.
 * @param config - where the brand lands.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  const home = resolveLynHome()
  const patchPath = resolveProfilePatch(resolved.target, home)
  const assetDirectory = resolveAssetDirectory(resolved.assetDirectory)
  const token = randomBytes(32).toString('base64url')
  // Applies run one at a time: the three SVGs and the row are one write to a
  // reader, and two in flight could leave the row naming one brand while the
  // artwork on disk is another's.
  const serialise = createSerialiser()

  /**
   * Whether this request may act, answering it when it may not.
   * @param res - the response.
   * @param carried - the token header this request carried.
   * @returns true when the caller should continue.
   */
  const admits = (res: ServerResponse, carried: string | string[] | undefined): boolean => {
    if (carriesToken(typeof carried === 'string' ? carried : undefined, token)) return true
    sendJson(res, 403, { error: 'this page needs the token the brand-setup command printed' })
    return false
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/',
    handler: (req, res) => {
      const carried = new URL(String(req.url), 'http://setup').searchParams.get('token') ?? undefined
      if (!carriesToken(carried, token)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('this page needs the token the brand-setup command printed\n')
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(renderSetupPage())
    },
  }), 'brand-setup: page')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/state',
    handler: async (req, res) => {
      if (!admits(res, req.headers[TOKEN_HEADER])) return
      const layer = await readFile(patchPath, 'utf8').catch(() => '')
      sendJson(res, 200, { ...readCurrentBrand(layer), patchPath, assetDirectory })
    },
  }), 'brand-setup: current brand')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/apply',
    handler: async (req, res) => {
      if (!admits(res, req.headers[TOKEN_HEADER])) return
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'apply takes a POST' }); return }
      try {
        const submitted = parseSubmission(await readBody(req))
        const result = await serialise(() => applySubmission(submitted, assetDirectory, patchPath))
        sendJson(res, 200, { assets: result.assets })
      } catch (error) {
        // The operator sees the reason; a studio refusal and a submission
        // refusal both name what to change, and anything else is this server's.
        const refusal = error instanceof SubmissionError || error instanceof StudioError
        if (!refusal) ctx.logger.error(error)
        sendJson(res, refusal ? 400 : 500, { error: refusal ? error.message : 'the brand could not be written' })
      }
    },
  }), 'brand-setup: apply')

  internals.stdout.write([
    'brand-setup: open this address on this machine; it is the only way in and it ends with this process.',
    `  http://127.0.0.1:${String(ctx.webServer.port)}/?token=${token}`,
    `  writes   ${patchPath}`,
    `  assets   ${assetDirectory}`,
    '',
  ].join('\n'))
}
