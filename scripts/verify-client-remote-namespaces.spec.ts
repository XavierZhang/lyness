/**
 * What the parked-namespace gate accepts and what it refuses: a Client plugin
 * injecting a namespace the assembly does not mount is a defect, because
 * Cordis parks it silently; a package that mounts contributions itself is not.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { injectedNamespaces, remoteMethodNames, unmountedClientInjections } from './verify-client-remote-namespaces.ts'
import ts from 'typescript'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** One package in a fixture repository: a manifest and one `src/client` module. */
interface Fixture {
  /** Manifest name, which the assembly imports as `<name>/remote`. */
  readonly name: string
  /** Repository-relative directory, defaulting to `packages/group/<name tail>`. */
  readonly directory?: string
  /** The module written to `<directory>/src/client/index.ts`. */
  readonly source?: string
}

/** Write one file and the directories above it. */
function write(root: string, relativePath: string, content: string): void {
  mkdirSync(join(root, dirname(relativePath)), { recursive: true })
  writeFileSync(join(root, relativePath), content)
}

/**
 * A fixture repository whose Client assembly mounts the named contributions.
 * @param mounts - packages the assembly imports a `/remote` contribution from.
 * @param packages - every package the repository holds, the assembly aside.
 * @returns the fixture root.
 */
function repository(mounts: readonly string[], packages: readonly Fixture[]): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-remote-namespaces-'))
  roots.push(root)
  write(root, 'packages/api/remotes/package.json', JSON.stringify({ name: '@deepseek-ai/dsh-api-remotes' }))
  write(root, 'packages/api/remotes/src/client/index.ts', [
    ...mounts.map((name, index) => `import contribution${String(index)} from '${name}/remote'`),
    `export const mounted = [${mounts.map((_name, index) => `contribution${String(index)}`).join(', ')}]`,
    '',
  ].join('\n'))
  for (const [index, entry] of packages.entries()) {
    const directory = entry.directory ?? `packages/group/p${String(index)}`
    write(root, `${directory}/package.json`, JSON.stringify({ name: entry.name }))
    if (entry.source !== undefined) write(root, `${directory}/src/client/index.ts`, entry.source)
  }
  return root
}

/** A provider declaring one Remote namespace. */
function provider(namespace: string, options = ''): string {
  return [
    "import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'",
    'export class Controller extends TypertRemoteService {',
    `  constructor(ctx: Context) { super(ctx, '${namespace}'${options}) }`,
    '}',
    '',
  ].join('\n')
}

/** Parse one probe module the way the gate does. */
function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('probe.ts', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
}

describe('what counts as an injection', () => {
  it('reads a declared `inject` list and a `ctx.inject` array, and nothing else', () => {
    const found = injectedNamespaces(parse([
      "export const inject = ['slots', 'remote', 'remote.people']",
      "class Page { static inject = ['remote.bots'] }",
      "ctx.inject(['remote.audit'], (scoped) => scoped)",
      "const optional = ctx.get('remote.credits')",
      "const path = join(dir, 'remote.txt')",
      '',
    ].join('\n')))
    expect(found).toEqual([
      { namespace: 'people', line: 1 },
      { namespace: 'bots', line: 2 },
      { namespace: 'audit', line: 3 },
    ])
  })
})

describe('the verdict', () => {
  it('accepts an injection of a namespace the assembly mounts', () => {
    const root = repository(['@deepseek-ai/dsh-api-people-controller'], [
      { name: '@deepseek-ai/dsh-api-people-controller', source: provider('people') },
      { name: '@deepseek-ai/dsh-client-ui-people', source: "export const inject = ['remote.people']\n" },
    ])
    expect(unmountedClientInjections(root)).toEqual([])
  })

  it('refuses an injection of a namespace nobody mounts', () => {
    // The eight administration pages this fork shipped parked: the page
    // injected the namespace and the assembly mounted no contribution for it,
    // so the page never appeared and its retry could never succeed.
    const root = repository([], [
      { name: '@deepseek-ai/dsh-client-ui-people', source: "export const inject = ['slots', 'remote.people']\n" },
    ])
    expect(unmountedClientInjections(root)).toEqual([
      'packages/api/remotes/src/client/index.ts: mounts no Remote namespace at all',
      'packages/group/p0/src/client/index.ts:1: injects remote.people, which the Client assembly does not mount',
    ])
  })

  it('honours a provider that renames its wire namespace', () => {
    const root = repository(['@deepseek-ai/dsh-api-announcement-controller'], [
      {
        name: '@deepseek-ai/dsh-api-announcement-controller',
        source: provider('announcementController', ", { namespace: 'announcements', requires: 'anyone' }"),
      },
      { name: '@deepseek-ai/dsh-client-ui-announcements', source: "export const inject = ['remote.announcements']\n" },
    ])
    expect(unmountedClientInjections(root)).toEqual([])
  })

  it('leaves a package that mounts contributions itself to answer for its own injections', () => {
    const root = repository(['@deepseek-ai/dsh-api-people-controller'], [
      { name: '@deepseek-ai/dsh-api-people-controller', source: provider('people') },
      {
        name: '@deepseek-ai/dsh-experimental-liveshare',
        source: [
          "export const inject = ['remote', 'remote.liveshareShares']",
          'export async function apply(ctx: Context) { await ctx.remote.$mount(contribution) }',
          '',
        ].join('\n'),
      },
    ])
    expect(unmountedClientInjections(root)).toEqual([])
  })

  it('reports an empty corpus rather than passing silently', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-remote-namespaces-empty-'))
    roots.push(root)
    expect(unmountedClientInjections(root)).toEqual([`${root}: no workspace package manifests found`])
  })

  it('names an assembly import that is not a workspace package', () => {
    const root = repository(['@elsewhere/thing'], [
      { name: '@deepseek-ai/dsh-api-people-controller', source: provider('people') },
    ])
    expect(unmountedClientInjections(root)).toEqual([
      'packages/api/remotes/src/client/index.ts: mounts @elsewhere/thing/remote, which is not a workspace package',
      'packages/api/remotes/src/client/index.ts: mounts no Remote namespace at all',
    ])
  })
})

describe('the reserved method names', () => {
  it('reads the name a decorator exports, not only the method\'s own', () => {
    const found = remoteMethodNames(parse([
      "import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'",
      'export class Controller extends TypertRemoteService {',
      '  @Remote async save(input: Input) { return input }',
      "  @Remote('list') async remoteExportList() { return [] }",
      '  private helper() { return 1 }',
      '}',
      '',
    ].join('\n')))
    expect(found).toEqual([{ method: 'save', line: 3 }, { method: 'list', line: 4 }])
  })

  it('refuses a method named like one of the namespace service\'s own members', () => {
    // Three of this fork's controllers declared `remove`, and the whole Client
    // boot failed the moment their namespaces were mounted.
    const root = repository([], [
      {
        name: '@deepseek-ai/dsh-api-people-controller',
        source: [
          "import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'",
          'export class Controller extends TypertRemoteService {',
          "  constructor(ctx: Context) { super(ctx, 'people') }",
          '  @Remote async remove(id: string) { return id }',
          '}',
          '',
        ].join('\n'),
      },
    ])
    expect(unmountedClientInjections(root)).toEqual([
      'packages/api/remotes/src/client/index.ts: mounts no Remote namespace at all',
      'packages/group/p0/src/client/index.ts:4: Remote method "remove" is a name the namespace service reserves',
    ])
  })
})
