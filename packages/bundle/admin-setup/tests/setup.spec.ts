/**
 * What one run writes into a patch layer, and what it refuses: the roster
 * entry, the provider row, the one binding, an administrator already written,
 * and every input a deployment could not use.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { redirectUri, runSetup, secureCookies, SetupError, upsertFirstAdministrator } from '../src/setup.ts'
import type { AdministratorRequest } from '../src/setup.ts'

/** One run's inputs, with the fields a case does not care about filled in. */
function request(over: Partial<AdministratorRequest> = {}): AdministratorRequest {
  return {
    person: 'ada',
    displayName: 'Ada',
    issuer: 'https://id.acme.example',
    clientId: 'client-1',
    subject: 'sub-ada',
    secretName: 'OIDC_CLIENT_SECRET',
    publicOrigin: 'https://agent.acme.example',
    replace: false,
    patchPath: '/tmp/unused/cordis.patch.yml',
    ...over,
  }
}

/** One row of a patch layer, as the Loader reads it. */
interface LayerRow {
  readonly id?: string
  readonly name?: string
  readonly insert?: readonly LayerRow[]
  readonly config?: Readonly<Record<string, unknown>>
}

/** The written layer, as the Loader reads it. */
function rows(layer: string): readonly (LayerRow | string)[] {
  return parse(layer) as readonly (LayerRow | string)[]
}

/** The rows of the written layer that are rows at all. */
function maps(layer: string): readonly LayerRow[] {
  return rows(layer).filter((row): row is LayerRow => typeof row === 'object')
}

/** One id-targeted patch row of the written layer. */
function rowOf(layer: string, id: string): LayerRow {
  const found = maps(layer).find(row => row.id === id)
  if (found === undefined) throw new Error(`the layer has no row for ${id}`)
  return found
}

/** The list one row's config holds under a key. */
function listOf(row: LayerRow, key: string): readonly unknown[] {
  const list = row.config?.[key]
  if (!Array.isArray(list)) throw new Error(`the row holds no list under ${key}`)
  return list as readonly unknown[]
}

/** Every insert entry of the written layer. */
function inserts(layer: string): readonly LayerRow[] {
  return maps(layer).filter(row => row.insert !== undefined)
}

/** The row the run inserts for the provider. */
function inserted(layer: string): LayerRow {
  const [entry] = inserts(layer)
  if (entry?.insert === undefined) throw new Error('the layer inserts nothing')
  const [row] = entry.insert
  if (row === undefined) throw new Error('the insert carries no row')
  return row
}

describe('writing the first administrator', () => {
  it('writes the roster entry, the provider and the binding into an empty layer', () => {
    const layer = upsertFirstAdministrator('[]\n', request())

    expect(rowOf(layer, 'people')).toEqual({
      id: 'people',
      config: { people: [{ id: 'ada', displayName: 'Ada', role: 'platform-administrator' }] },
    })
    // The provider is inserted, not patched: the accounts module composes
    // none, so a patch would name a row that does not exist.
    expect(inserted(layer)).toEqual({
      id: 'sign-in-channel-oidc',
      name: '@deepseek-ai/dsh-oidc',
      config: { issuer: 'https://id.acme.example', clientId: 'client-1', secret: 'OIDC_CLIENT_SECRET' },
    })
    // The routes cannot infer the origin, and the cookies' Secure follows the
    // scheme a browser actually uses.
    expect(rowOf(layer, 'sign-in-http')).toEqual({
      id: 'sign-in-http',
      config: { publicOrigin: 'https://agent.acme.example', secureCookies: true },
    })
    expect(rowOf(layer, 'sign-in-admission')).toEqual({
      id: 'sign-in-admission',
      config: {
        bindings: [{
          channel: 'oidc', issuer: 'https://id.acme.example', subject: 'sub-ada', person: 'ada',
        }],
      },
    })
  })

  it('names no package on the rows it patches', () => {
    const layer = upsertFirstAdministrator('[]\n', request())
    // A patch naming a package the composed row does not load is skipped, and
    // which package answers an id is the module's to change — the admission
    // row already changed hands once.
    expect(rowOf(layer, 'people')).not.toHaveProperty('name')
    expect(rowOf(layer, 'sign-in-admission')).not.toHaveProperty('name')
  })

  it('creates the layer when the profile has written none', () => {
    const layer = upsertFirstAdministrator('', request())
    expect(rows(layer)).toHaveLength(4)
  })

  it('reads the cookies and the redirect URI off the origin the operator gave', () => {
    expect(secureCookies('https://agent.acme.example')).toBe(true)
    // Plain HTTP is a development install, and a Secure cookie would never
    // reach it.
    expect(secureCookies('http://127.0.0.1:7788')).toBe(false)
    expect(redirectUri('http://127.0.0.1:7788')).toBe('http://127.0.0.1:7788/auth/callback/oidc')

    const layer = upsertFirstAdministrator('[]\n', request({ publicOrigin: 'http://127.0.0.1:7788' }))
    expect(rowOf(layer, 'sign-in-http').config).toEqual({
      publicOrigin: 'http://127.0.0.1:7788', secureCookies: false,
    })
  })

  it('is idempotent: running it twice leaves one of everything', () => {
    const once = upsertFirstAdministrator('[]\n', request())
    const twice = upsertFirstAdministrator(once, request())
    expect(twice).toBe(once)
  })

  it('updates the subject when the provider gives the same person another identity', () => {
    const once = upsertFirstAdministrator('[]\n', request())
    const twice = upsertFirstAdministrator(once, request({ subject: 'sub-moved' }))
    // One binding for one person on one channel: a second would admit the
    // identity they no longer have.
    expect(listOf(rowOf(twice, 'sign-in-admission'), 'bindings')).toEqual([{
      channel: 'oidc', issuer: 'https://id.acme.example', subject: 'sub-moved', person: 'ada',
    }])
  })

  it('keeps everything in the layer it does not own', () => {
    const existing = [
      '# the operator wrote this',
      '- id: web-runtime',
      '  config:',
      '    port: 8080',
      '- id: people',
      '  config:',
      '    people:',
      '      - id: bea',
      '        displayName: Bea',
      '        role: member',
      '- id: sign-in-admission',
      '  config:',
      '    bindings:',
      '      - channel: wecom',
      '        issuer: ww-acme',
      '        subject: bea-wecom',
      '        person: bea',
      '',
    ].join('\n')
    const layer = upsertFirstAdministrator(existing, request())

    expect(layer).toContain('# the operator wrote this')
    expect(listOf(rowOf(layer, 'people'), 'people')).toEqual([
      { id: 'bea', displayName: 'Bea', role: 'member' },
      { id: 'ada', displayName: 'Ada', role: 'platform-administrator' },
    ])
    expect(listOf(rowOf(layer, 'sign-in-admission'), 'bindings')).toHaveLength(2)
    expect(rowOf(layer, 'web-runtime')).toEqual({ id: 'web-runtime', config: { port: 8080 } })
  })

  it('reuses a provider row an earlier run inserted', () => {
    const once = upsertFirstAdministrator('[]\n', request())
    const twice = upsertFirstAdministrator(once, request({ clientId: 'client-2' }))
    expect(inserts(twice)).toHaveLength(1)
    expect(inserted(twice)).toMatchObject({ config: { clientId: 'client-2' } })
  })

  it('completes a provider row that was inserted without a config', () => {
    const existing = ['- insert:', '    - id: sign-in-channel-oidc', '      name: \'@deepseek-ai/dsh-oidc\'', ''].join('\n')
    const layer = upsertFirstAdministrator(existing, request())
    expect(inserted(layer)).toMatchObject({ config: { issuer: 'https://id.acme.example' } })
  })

  it('reads past a row that is not a map at all', () => {
    const layer = upsertFirstAdministrator('- just-a-string\n', request())
    // Somebody else's hand-written scalar: left where it is, and the run adds
    // its own rows after it.
    expect(rows(layer)[0]).toBe('just-a-string')
    expect(rowOf(layer, 'people')).toBeDefined()
  })

  it('reads past an insert that carries somebody else\'s row', () => {
    const existing = ['- insert:', '    - id: something-else', '      name: \'@acme/other\'', ''].join('\n')
    const layer = upsertFirstAdministrator(existing, request())
    // Two inserts: the one already there, and this run's own.
    expect(inserts(layer)).toHaveLength(2)
  })
})

describe('replacing the file', () => {
  const directories: string[] = []
  afterEach(async () => {
    await Promise.all(directories.splice(0).map(async (dir) => { await rm(dir, { recursive: true, force: true }) }))
  })

  it('creates a layer the profile has never written', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'admin-setup-layer-'))
    directories.push(dir)
    const patchPath = join(dir, 'cordis.patch.yml')
    await runSetup(request({ patchPath }))
    expect(parse(await readFile(patchPath, 'utf8'))).toHaveLength(4)
  })

  it('reports a layer it cannot read as itself', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'admin-setup-layer-'))
    directories.push(dir)
    // A directory where the layer should be: not this run's to interpret, and
    // writing over it would be worse than refusing.
    await expect(runSetup(request({ patchPath: dir }))).rejects.toThrow(/EISDIR/u)
  })
})

describe('what one run refuses', () => {
  it('refuses a second administrator unless the operator says to replace the first', () => {
    const once = upsertFirstAdministrator('[]\n', request())
    expect(() => upsertFirstAdministrator(once, request({ person: 'bea', displayName: 'Bea' })))
      .toThrow(/already has a written administrator: "ada"/u)

    const replaced = upsertFirstAdministrator(once, request({ person: 'bea', displayName: 'Bea', replace: true }))
    // One written administrator, and the one it replaced is gone rather than
    // left beside it.
    expect(listOf(rowOf(replaced, 'people'), 'people'))
      .toEqual([{ id: 'bea', displayName: 'Bea', role: 'platform-administrator' }])
  })

  it('refuses an input a deployment could not use, naming the field', () => {
    const cases: readonly [Partial<AdministratorRequest>, RegExp][] = [
      [{ person: 'has space' }, /person id/u],
      [{ displayName: 'two\nlines' }, /name must be one line/u],
      [{ subject: 'with space' }, /subject must be/u],
      [{ secretName: 'not a reference' }, /credential reference/u],
      [{ issuer: 'id.acme.example' }, /issuer must be a URL/u],
      [{ issuer: 'ftp://id.acme.example' }, /issuer must be an http or https URL/u],
      [{ publicOrigin: 'agent.acme.example' }, /public origin must be a URL/u],
      [{ publicOrigin: 'ftp://agent.acme.example' }, /public origin must be an http/u],
      [{ publicOrigin: 'https://agent.acme.example/app' }, /carries a path/u],
    ]
    for (const [over, message] of cases) {
      expect(() => upsertFirstAdministrator('[]\n', request(over)), JSON.stringify(over)).toThrow(message)
    }
  })

  it('refuses a layer it cannot read, and one that is not a list of rows', () => {
    expect(() => upsertFirstAdministrator('- id: [unclosed\n', request())).toThrow(SetupError)
    expect(() => upsertFirstAdministrator('id: people\n', request())).toThrow(/top-level YAML array/u)
  })

  it('replaces a roster entry that is not a map, rather than reading into it', () => {
    const existing = ['- id: people', '  config:', '    people:', '      - just-a-string', ''].join('\n')
    const layer = upsertFirstAdministrator(existing, request())
    // The string is left where it was: this run owns the administrator entry
    // and nothing else in that list.
    expect(listOf(rowOf(layer, 'people'), 'people'))
      .toEqual(['just-a-string', { id: 'ada', displayName: 'Ada', role: 'platform-administrator' }])
  })
})
