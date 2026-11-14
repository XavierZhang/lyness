/**
 * @lyness/lyn-host-frontend-static — SPA dist server over the webserver
 * fallback seat: a webserver resource serving the built frontend directory
 * with explicit index entry points. A readable index renders at the dist root
 * and configured index path; missing paths return 404, traversal outside the
 * dist root is 403, unknown extensions ship as octet-stream, and non-GET/HEAD
 * is 405. An HTTP index request first passes Connection's browser
 * authentication and renders for its admitted Peer; an in-process read renders
 * for the Peer its caller admitted. Both renders go through the webserver's
 * index render (structured injection rows, then raw taps). Non-index assets
 * stay public; every file other than the index carries a weak ETag with
 * `cache-control: no-cache` and answers a matching `If-None-Match` with 304,
 * while the index carries no cache headers. The dist location is workspace
 * knowledge of the composing application, so `distIndex` is typically
 * supplied through a `!!js` expression, never hardcoded by a deployment.
 * @module @lyness/lyn-host-frontend-static
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type { PeerScope } from '@lyness/lyn-client-connection'
import type {} from '@lyness/lyn-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'frontend-static'

/** Services required before the authenticated fallback seat can be claimed. */
export const inject = ['webServer', 'connection']

/** Plugin config: the dist anchor, and any extra page the same dist answers. */
export interface Config {
  /** Absolute path of index.html inside the dist root. */
  distIndex: string
  /**
   * Extra pathnames that answer with the index document rather than with a file.
   *
   * One entry per page a composition serves from the same dist: the browser
   * asks for `/admin`, this answers the same document, and the client decides
   * which shell to render from the path it was served at. Each is an absolute
   * pathname with no trailing slash and no further segment, because the
   * injected `<base href="./">` resolves every app route against the
   * document's own directory: `/admin` resolves `api/...` to `/api/...`, while
   * `/admin/` or `/a/b` would resolve it under that directory and reach
   * nothing. A request carrying the trailing slash is redirected to the path
   * itself for the same reason.
   */
  documentPaths?: string[]
}

export const Config: z<Config> = z.object({
  distIndex: z.string().required(),
  documentPaths: z.array(z.string()).default([]),
})

/**
 * Refuse a configured page path that cannot carry the document.
 * @param paths - the configured extra document paths.
 * @returns the same paths, as a set.
 * @throws {Error} when one is not an absolute single-segment pathname.
 */
export function documentPathSet(paths: readonly string[]): ReadonlySet<string> {
  for (const path of paths) {
    if (!/^\/[^/]+$/u.test(path)) {
      throw new Error(`frontend-static: documentPaths entry ${JSON.stringify(path)} must be an absolute pathname of one segment, such as "/admin"`)
    }
  }
  return new Set(paths)
}

const HTML_MIME = 'text/html; charset=utf-8'

const MIME: Record<string, string> = {
  '.html': HTML_MIME,
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  // Launchers require an image Content-Type for the install icons.
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  // The packed VFS image. Served as its own bytes, never as a Content-Encoding:
  // the worker inflates the body itself, and a transport-level encoding would
  // leave it inflating an already-decoded archive.
  '.gz': 'application/gzip',
}

const STATIC_MISS_CODES: ReadonlySet<string | undefined> = new Set([
  'ENOENT',
  'EISDIR',
  'ENOTDIR',
])

/** A Response body that is `bytes` itself, without the copy a buffer body gets. */
function bytesBody(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

/**
 * Answer one GET or HEAD dist request; the webserver answers any other method
 * with 405 before a resource runs. A malformed percent-escape or a filesystem
 * failure other than a missing or non-file target rejects.
 * @param request - the request; only its method and URL path are read.
 * @param distRoot - absolute dist root directory (resolved by the caller).
 * @param distIndex - absolute path of index.html inside distRoot.
 * @param renderIndex - present for index requests to turn the raw index.html
 * into the served document; omitted for ordinary static files.
 * @returns the dist response; a HEAD response carries the GET status and
 * headers without a body. A file other than the index carries
 * `cache-control: no-cache` and a weak ETag from a SHA-1 of its bytes, and a
 * request whose `If-None-Match` equals that ETag receives an empty 304.
 */
async function serveStatic(
  request: Request, distRoot: string, distIndex: string,
  renderIndex?: (html: string) => string,
  documents: ReadonlySet<string> = new Set(),
): Promise<Response> {
  const pathname = decodeURIComponent(new URL(request.url).pathname)
  // A configured page carries the document itself, and the same path with a
  // trailing slash would make `<base href="./">` resolve every app route one
  // directory deeper, so it is redirected rather than served.
  if (pathname.endsWith('/') && documents.has(pathname.slice(0, -1))) {
    return new Response(null, { status: 308, headers: { location: pathname.slice(0, -1) } })
  }
  const target = documents.has(pathname) ? distIndex : resolve(normalize(join(distRoot, pathname)))
  // Traversal rejection: the target must be distRoot itself (`/`) or stay under
  // it. `sep`, not '/': resolve() emits backslash paths on Windows, where a '/'
  // suffix would reject every legitimate subpath as traversal.
  if (target !== distRoot && !target.startsWith(distRoot + sep)) return new Response(null, { status: 403 })
  let body: string | Uint8Array<ArrayBuffer>
  let headers: Record<string, string>
  try {
    if (renderIndex !== undefined) {
      const html = await readFile(distIndex, 'utf8')
      request.signal.throwIfAborted()
      body = renderIndex(html)
      headers = { 'content-type': HTML_MIME }
    } else {
      body = await readFile(target)
      // Weak: gzip changes the transferred bytes.
      const cache = { 'cache-control': 'no-cache', etag: `W/"${createHash('sha1').update(body).digest('base64url')}"` }
      if (request.headers.get('if-none-match') === cache.etag) return new Response(null, { status: 304, headers: cache })
      headers = { 'content-type': MIME[extname(target)] ?? 'application/octet-stream', ...cache }
    }
  } catch (error) {
    // Only absent or non-file targets are 404; other filesystem failures reach
    // the caller, which the webserver answers with 400 over HTTP.
    if (!STATIC_MISS_CODES.has((error as NodeJS.ErrnoException).code)) throw error
    return new Response(null, { status: 404 })
  }
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(typeof body === 'string' ? body : bytesBody(body), { status: 200, headers })
}

/**
 * Claim the webserver fallback seat with a resource serving the dist.
 * @param ctx - plugin context carrying the webServer and connection services.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const distIndex = config.distIndex
  const distRoot = dirname(distIndex)
  // Which paths carry the application document themselves, so the same path
  // with a trailing slash is redirected rather than served.
  const documents = documentPathSet(config.documentPaths ?? [])
  // A configured document path carries the application document, so it is the
  // index for both decisions below: the authentication policy an index needs,
  // and the render that puts the base href in. Resolving it as a file instead
  // would serve `/admin` as a missing static asset.
  const carriesDocument = (url: URL): boolean => {
    const pathname = decodeURIComponent(url.pathname)
    if (documents.has(pathname)) return true
    const target = resolve(normalize(join(distRoot, pathname)))
    return target === distRoot || target === distIndex
  }
  ctx.effect(() => ctx.webServer.registerFallback({
    auth: request => carriesDocument(request.url) ? 'required' : 'anonymous',
    resource: (request, peer) => {
      request.signal.throwIfAborted()
      if (!carriesDocument(new URL(request.url))) return serveStatic(request, distRoot, distIndex, undefined, documents)
      // WebServer admits every index request before invoking this resource.
      const pagePeer = peer as PeerScope
      const render = (html: string): string => {
        request.signal.throwIfAborted()
        pagePeer.signal.throwIfAborted()
        return ctx.webServer.renderIndex(html, pagePeer)
          .replace(/<head(?:\s[^>]*)?>/i, open => `${open}<base href="./">`)
      }
      return serveStatic(request, distRoot, distIndex, render, documents)
    },
  }), 'frontend-static: fallback seat')
}
