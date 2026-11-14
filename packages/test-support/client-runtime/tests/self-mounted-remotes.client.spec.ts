/** The stand-in table both the Vitest config and the assembly tier read. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasGeneratedContribution, SELF_MOUNTED_REMOTES, STAND_IN_MODULE, STAND_IN_NAMESPACES_ENV, standInNamespaces, standInNamespacesOnDisk,
} from '../src/assembly/self-mounted-remotes.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A repository root holding built contributions for the named directories only. */
function rootWithBuilt(directories: readonly string[]): URL {
  const root = mkdtempSync(join(tmpdir(), 'dsh-stand-in-'))
  roots.push(root)
  for (const directory of directories) {
    mkdirSync(join(root, directory, 'lib'), { recursive: true })
    writeFileSync(join(root, directory, 'lib', 'typert.remote-client.js'), 'export default {}\n')
  }
  return pathToFileURL(`${root}/`)
}

describe('self-mounted Remote stand-ins', () => {
  it('names a stand-in module and an environment variable for the recorded namespaces', () => {
    expect(STAND_IN_MODULE).toBe('tests/generated-remote-stub.ts')
    expect(STAND_IN_NAMESPACES_ENV).toBe('DSH_STAND_IN_REMOTE_NAMESPACES')
  })

  it('reports built output per package', () => {
    const [liveshare, capabilities] = SELF_MOUNTED_REMOTES as [typeof SELF_MOUNTED_REMOTES[number], typeof SELF_MOUNTED_REMOTES[number]]
    const root = rootWithBuilt([liveshare.directory])
    expect(hasGeneratedContribution(liveshare, root)).toBe(true)
    expect(hasGeneratedContribution(capabilities, root)).toBe(false)
  })

  it('leaves out the namespaces whose package is built, and every row outside the roster', () => {
    const built = SELF_MOUNTED_REMOTES.filter(remote => remote.namespaces.length > 0).slice(0, 1)
    const root = rootWithBuilt(built.map(remote => remote.directory))
    const expected = SELF_MOUNTED_REMOTES
      .filter(remote => !built.includes(remote))
      .flatMap(remote => remote.namespaces)
    expect(standInNamespacesOnDisk(root)).toEqual(expected)
    expect(standInNamespacesOnDisk(rootWithBuilt(SELF_MOUNTED_REMOTES.map(remote => remote.directory)))).toEqual([])
  })

  it('reads the recorded namespaces, treating an absent or empty variable as none', () => {
    expect(standInNamespaces({ [STAND_IN_NAMESPACES_ENV]: 'memories,sessionData' })).toEqual(['memories', 'sessionData'])
    expect(standInNamespaces({ [STAND_IN_NAMESPACES_ENV]: '' })).toEqual([])
    expect(standInNamespaces({})).toEqual([])
  })

  it('reads this process by default, which the Vitest config has already recorded', () => {
    expect(standInNamespaces()).toEqual(standInNamespaces(process.env))
  })

  it('carries a stand-in and a namespace list for every row', () => {
    for (const remote of SELF_MOUNTED_REMOTES) {
      expect(remote.package.startsWith('@deepseek-ai/'), remote.package).toBe(true)
      expect(remote.directory.startsWith('packages/'), remote.directory).toBe(true)
      expect(new Set(remote.namespaces).size).toBe(remote.namespaces.length)
    }
    expect(new Set(SELF_MOUNTED_REMOTES.map(remote => remote.package)).size).toBe(SELF_MOUNTED_REMOTES.length)
  })
})
