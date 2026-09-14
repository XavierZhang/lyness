/**
 * Coverage over the surfaces a browser actually reaches: the rendered index
 * head from the real webserver's `renderIndex`, and the asset route over real
 * HTTP. The load-time refusals are asserted as plugin rejections, because a
 * deployment that names a missing file must fail to start rather than serve a
 * page whose brand silently fell back.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import HttpServer from '@lyness/lyn-host-webserver'
import * as BrandDeployment from '../src/index.ts'
import type { Config } from '../src/index.ts'

const INDEX = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  '    <title>LYN Local Build</title>',
  '  </head>',
  '  <body><div id="root"></div></body>',
  '</html>',
].join('\n')

const directories: string[] = []
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

/** A fixture directory holding the named files, registered for removal. */
async function assetDirectory(files: Readonly<Record<string, string>>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lyn-brand-assets-'))
  directories.push(directory)
  for (const [name, body] of Object.entries(files)) await writeFile(join(directory, name), body)
  return directory
}

/** Mount the real webserver on an OS-assigned port. */
async function server(): Promise<Context> {
  context = new Context()
  await context.plugin(HttpServer, { host: '127.0.0.1', port: 0 })
  return context
}

/** Mount the brand row over a running webserver. */
async function brand(ctx: Context, config: Config) {
  return ctx.plugin(BrandDeployment, config)
}

/** GET one path against the running server. */
async function get(ctx: Context, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`http://127.0.0.1:${String(ctx.webServer.port)}${path}`, init)
}

describe('deployment brand over the index render', () => {
  it('replaces the title, adds the theme colour, and publishes the brand global', async () => {
    const ctx = await server()
    await brand(ctx, { productName: 'Acme <Agent> & Co', themeColor: '#1f6feb' })
    const html = ctx.webServer.renderIndex(INDEX)

    expect(html).toContain('<title>Acme &lt;Agent&gt; &amp; Co</title>')
    expect(html).not.toContain('LYN Local Build')
    expect(html).toContain('<meta name="theme-color" content="#1f6feb" />')
    expect(html).toContain(`globalThis["${BrandDeployment.DEPLOYMENT_BRAND_GLOBAL}"]`)
    // The row renderer escapes `<` in the JSON, so a value cannot close the
    // script element. `>` needs no escape and stays literal.
    expect(html).toContain('"productName":"Acme \\u003cAgent> & Co"')
    expect(html).toContain('"showPoweredBy":false')
    // No favicon configured, so the shipped icon link survives untouched.
    expect(html).toContain('href="/favicon.svg"')
  })

  it('adds a title to a head that declares none', async () => {
    const ctx = await server()
    await brand(ctx, { productName: 'Acme' })
    expect(ctx.webServer.renderIndex('<head></head><body></body>')).toContain('<title>Acme</title>')
  })

  it('adds an icon link to a head that declares none', async () => {
    const directory = await assetDirectory({ 'logo.svg': '<svg/>' })
    const ctx = await server()
    await brand(ctx, { assetDirectory: directory, favicon: 'logo.svg' })
    expect(ctx.webServer.renderIndex('<head></head><body></body>'))
      .toContain('<head><link rel="icon" href="/brand/favicon.svg" />')
  })

  it('answers HEAD with the asset headers and no body', async () => {
    const directory = await assetDirectory({ 'logo.svg': '<svg/>' })
    const ctx = await server()
    await brand(ctx, { assetDirectory: directory, favicon: 'logo.svg' })
    const head = await get(ctx, '/brand/favicon.svg', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toBe('image/svg+xml')
    expect(await head.text()).toBe('')
  })

  it('answers a miss when a placed asset is removed while the deployment runs', async () => {
    const directory = await assetDirectory({ 'logo.svg': '<svg/>' })
    const ctx = await server()
    await brand(ctx, { assetDirectory: directory, favicon: 'logo.svg' })
    await rm(join(directory, 'logo.svg'))
    expect((await get(ctx, '/brand/favicon.svg')).status).toBe(404)
  })

  it('serves each configured asset and answers every other path on the route with 404', async () => {
    const directory = await assetDirectory({ 'logo.svg': '<svg/>', 'word.png': 'PNG' })
    const ctx = await server()
    await brand(ctx, { assetDirectory: directory, favicon: 'logo.svg', wordmark: 'word.png' })

    const html = ctx.webServer.renderIndex(INDEX)
    expect(html).toContain('<link rel="icon" href="/brand/favicon.svg" />')
    expect(html).not.toContain('href="/favicon.svg"')
    expect(html).toContain('"wordmarkUrl":"/brand/wordmark.png"')

    const icon = await get(ctx, '/brand/favicon.svg')
    expect(icon.status).toBe(200)
    expect(icon.headers.get('content-type')).toBe('image/svg+xml')
    expect(icon.headers.get('cache-control')).toBe('no-cache')
    expect(await icon.text()).toBe('<svg/>')

    const wordmark = await get(ctx, '/brand/wordmark.png')
    expect(wordmark.status).toBe(200)
    expect(wordmark.headers.get('content-type')).toBe('image/png')

    // A role nothing configured, a traversal attempt, and the file's own name
    // are all misses: the handler reads a fixed table, never the request path.
    for (const path of ['/brand/mark.svg', '/brand/../logo.svg', '/brand/logo.svg', '/brand']) {
      expect((await get(ctx, path)).status).toBe(404)
    }
    expect((await get(ctx, '/brand/favicon.svg', { method: 'POST' })).status).toBe(405)
  })

  it('releases the route and the index transform when its fiber is disposed', async () => {
    const directory = await assetDirectory({ 'logo.svg': '<svg/>' })
    const ctx = await server()
    const fiber = await brand(ctx, { productName: 'Acme', assetDirectory: directory, favicon: 'logo.svg' })
    expect((await get(ctx, '/brand/favicon.svg')).status).toBe(200)

    await fiber.dispose()
    expect(ctx.webServer.renderIndex(INDEX)).toContain('<title>LYN Local Build</title>')
    expect((await get(ctx, '/brand/favicon.svg')).status).toBe(404)
  })

  it('mounts with no brand at all, leaving the shipped index untouched', async () => {
    const ctx = await server()
    await brand(ctx, {})
    const html = ctx.webServer.renderIndex(INDEX)
    expect(html).toContain('<title>LYN Local Build</title>')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).not.toContain('theme-color')
    expect((await get(ctx, '/brand/favicon.svg')).status).toBe(404)
  })

  it('refuses a colour, a directory, and an asset an operator got wrong', async () => {
    const ctx = await server()
    await expect(brand(ctx, { themeColor: 'rgb(1,2,3)' }))
      .rejects.toThrow(/themeColor must be a hex triplet or a colour keyword/u)
    await expect(brand(ctx, { favicon: 'logo.svg' }))
      .rejects.toThrow(/favicon named without assetDirectory/u)
    await expect(brand(ctx, { assetDirectory: 'relative/path', favicon: 'logo.svg' }))
      .rejects.toThrow(/assetDirectory must be absolute/u)

    const directory = await assetDirectory({ 'logo.txt': 'not an image' })
    await expect(brand(ctx, { assetDirectory: join(directory, 'absent'), favicon: 'logo.svg' }))
      .rejects.toThrow(/is not a directory/u)
    await expect(brand(ctx, { assetDirectory: directory, favicon: 'absent.svg' }))
      .rejects.toThrow(/favicon .* is not a readable file/u)
    await expect(brand(ctx, { assetDirectory: directory, favicon: 'logo.txt' }))
      .rejects.toThrow(/favicon .* has no serveable image type/u)
    await expect(brand(ctx, { assetDirectory: directory, favicon: '../logo.svg' }))
      .rejects.toThrow(/leaves assetDirectory|is not a readable file/u)
  })
})
