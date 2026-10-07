/**
 * The setup server as an operator meets it: the page, the two routes it calls,
 * and the token that is the only way to any of them.
 *
 * The server is the real `lyn-host-webserver` on a loopback port, so these
 * drive it over HTTP rather than calling the handlers.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@lyness/cordis'
import { WebServer } from '@lyness/lyn-host-webserver'
import { internals } from '@lyness/lyn-cmdline'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { apply, Config, inject, MAXIMUM_ICON_BYTES, name, TOKEN_HEADER } from '../src/index.ts'

const ICON = fileURLToPath(new URL('./fixtures/icon.png', import.meta.url))

afterEach(() => { vi.unstubAllEnvs() })

/** One running setup server, with the address and token it printed. */
async function server(assetDirectory?: string): Promise<{ origin: string; token: string; home: string; printed: string }> {
  const home = await mkdtemp(join(tmpdir(), 'lyn-brand-setup-home-'))
  onTestFinished(async () => { await rm(home, { recursive: true, force: true }) })
  vi.stubEnv('LYNESS_HOME', home)

  let printed = ''
  const stdout = internals.stdout
  internals.stdout = { write: (chunk: string) => { printed += chunk } }
  onTestFinished(() => { internals.stdout = stdout })

  const ctx = new Context()
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 }).await()
  const fiber = ctx.plugin({ name, inject: [...inject], apply, Config },
    assetDirectory === undefined ? {} : { assetDirectory })
  await fiber.await()
  onTestFinished(async () => { await fiber.dispose() })

  const token = /token=([\w-]+)/u.exec(printed)?.[1]
  if (token === undefined) throw new Error(`the command printed no token: ${printed}`)
  const webServer = ctx.get('webServer') as WebServer
  return { origin: `http://127.0.0.1:${String(webServer.port)}`, token, home, printed }
}

describe('brand-setup server', () => {
  it('prints one address carrying the token, and the paths it will write', async () => {
    const subject = await server(undefined)
    expect(subject.printed).toContain(`${subject.origin}/?token=${subject.token}`)
    expect(subject.printed).toContain(join(subject.home, 'profiles', 'web', 'cordis.patch.yml'))
    expect(subject.printed).toContain(join(subject.home, 'brand'))
    expect(subject.token.length).toBeGreaterThanOrEqual(32)
  })

  it('writes the artwork where the configuration names, in place of the home default', async () => {
    const elsewhere = await mkdtemp(join(tmpdir(), 'lyn-brand-setup-assets-'))
    onTestFinished(async () => { await rm(elsewhere, { recursive: true, force: true }) })
    const subject = await server(join(elsewhere, 'brand'))
    expect(subject.printed).toContain(join(elsewhere, 'brand'))
    expect(subject.printed).not.toContain(join(subject.home, 'brand'))
  })

  it('serves the page only to the address carrying the token', async () => {
    const { origin, token } = await server(undefined)
    const refused = await fetch(`${origin}/`)
    expect(refused.status).toBe(403)
    expect(await refused.text()).toContain('token')

    const wrong = await fetch(`${origin}/?token=${'a'.repeat(token.length)}`)
    expect(wrong.status).toBe(403)

    const page = await fetch(`${origin}/?token=${token}`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toContain('text/html')
    const html = await page.text()
    expect(html).toContain('<title>lyness brand setup</title>')
    // The page drops the token from the address as soon as it has read it.
    expect(html).toContain('history.replaceState')
  })

  it('answers the current brand only to a request carrying the token', async () => {
    const { origin, token, home } = await server(undefined)
    expect((await fetch(`${origin}/state`)).status).toBe(403)

    const state = await fetch(`${origin}/state`, { headers: { [TOKEN_HEADER]: token } })
    expect(state.status).toBe(200)
    expect(await state.json()).toEqual({
      config: {},
      colors: {},
      patchPath: join(home, 'profiles', 'web', 'cordis.patch.yml'),
      assetDirectory: join(home, 'brand'),
    })
  })

  it('writes the brand a submission names and reads it back', async () => {
    const { origin, token, home } = await server(undefined)
    const icon = await readFile(ICON)
    const applied = await fetch(`${origin}/apply`, {
      method: 'POST',
      headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
      body: JSON.stringify({
        productName: 'Acme Agent',
        productAbbreviation: 'ACME',
        productNameZh: '艾可',
        themeColor: '#1a73e8',
        colors: { blue: '#1a73e8', gray50: 'white' },
        acceptTrademark: true,
        icon: icon.toString('base64'),
      }),
    })
    expect(applied.status).toBe(200)
    expect(await applied.json()).toEqual({
      assets: {
        mark: join(home, 'brand', 'mark.svg'),
        wordmark: join(home, 'brand', 'wordmark.svg'),
        favicon: join(home, 'brand', 'favicon.svg'),
      },
    })

    const layer = await readFile(join(home, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
    expect(layer).toContain('productAbbreviation: ACME')
    expect(layer).toContain('productNameZh: 艾可')

    // The page reopens on what the row now carries.
    const state = await (await fetch(`${origin}/state`, { headers: { [TOKEN_HEADER]: token } })).json() as {
      config: Record<string, string>
      colors: Record<string, string>
    }
    expect(state.config).toMatchObject({ productName: 'Acme Agent', productAbbreviation: 'ACME', productNameZh: '艾可' })
    expect(state.colors).toEqual({ blue: '#1a73e8', gray50: 'white' })
  })

  it('refuses a body larger than an icon this page accepts', async () => {
    const { origin, token } = await server(undefined)
    const oversized = await fetch(`${origin}/apply`, {
      method: 'POST',
      headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
      body: 'x'.repeat(MAXIMUM_ICON_BYTES * 2),
    })
    expect(oversized.status).toBe(400)
    expect((await oversized.json() as { error: string }).error).toContain('larger than this page accepts')
  })

  it('opens on an empty brand when the patch layer is gone', async () => {
    const { origin, token, home } = await server(undefined)
    await rm(join(home, 'profiles', 'web', 'cordis.patch.yml'), { force: true })
    const state = await fetch(`${origin}/state`, { headers: { [TOKEN_HEADER]: token } })
    expect(await state.json()).toMatchObject({ config: {}, colors: {} })
  })

  it('keeps a failure no submission caused off the page', async () => {
    const elsewhere = await mkdtemp(join(tmpdir(), 'lyn-brand-setup-blocked-'))
    onTestFinished(async () => { await rm(elsewhere, { recursive: true, force: true }) })
    // A file where the artwork directory belongs: the write fails for a reason
    // the operator cannot act on from this page.
    await writeFile(join(elsewhere, 'brand'), 'not a directory')
    const { origin, token } = await server(join(elsewhere, 'brand'))
    const failed = await fetch(`${origin}/apply`, {
      method: 'POST',
      headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
      body: JSON.stringify({ acceptTrademark: true, productName: 'Acme', icon: (await readFile(ICON)).toString('base64') }),
    })
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'the brand could not be written' })
  })

  it('names what a refused submission got wrong and writes nothing', async () => {
    const { origin, token, home } = await server(undefined)
    const send = async (body: unknown): Promise<{ status: number; error: string }> => {
      const response = await fetch(`${origin}/apply`, {
        method: 'POST',
        headers: { [TOKEN_HEADER]: token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const { error } = await response.json() as { error: string }
      return { status: response.status, error }
    }
    const icon = (await readFile(ICON)).toString('base64')

    for (const [body, reason] of [
      [{ productName: 'Acme', icon }, 'trademark'],
      [{ acceptTrademark: true, icon }, 'productName'],
      [{ acceptTrademark: true, productName: 'Acme' }, 'icon'],
      [{ acceptTrademark: true, productName: 'Acme', icon, colors: { blue: 'rgb(1,2,3)' } }, 'hex colour'],
      [{ acceptTrademark: true, productName: 'A{B}', icon }, 'one line'],
    ] as const) {
      const refused = await send(body)
      expect(refused.status, reason).toBe(400)
      expect(refused.error).toContain(reason)
    }

    const refusedMethod = await fetch(`${origin}/apply`, { headers: { [TOKEN_HEADER]: token } })
    expect(refusedMethod.status).toBe(405)

    // Writing is the one thing this page does, so it is refused first of all.
    const untokened = await fetch(`${origin}/apply`, { method: 'POST', body: '{}' })
    expect(untokened.status).toBe(403)

    await expect(readFile(join(home, 'brand', 'mark.svg'))).rejects.toThrow(/ENOENT/u)
  })
})
