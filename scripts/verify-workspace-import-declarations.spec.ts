/**
 * What the undeclared-import gate accepts and what it refuses: a runtime
 * import of a workspace package the importer does not declare is a defect; a
 * type-only one is not, because it emits nothing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  runtimePackageImports, undeclaredWorkspaceImports, workspacePackages,
} from './verify-workspace-import-declarations.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** One package in a fixture repository: a manifest and one `src` module. */
interface Fixture {
  readonly name: string
  readonly declares?: readonly string[]
  readonly source?: string
}

/** A fixture repository holding the given packages under `packages/group/<n>`. */
function repository(packages: readonly Fixture[]): string {
  const root = mkdtempSync(join(tmpdir(), 'lyn-undeclared-imports-'))
  roots.push(root)
  for (const [index, entry] of packages.entries()) {
    const directory = join(root, 'packages', 'group', `p${String(index)}`)
    mkdirSync(join(directory, 'src'), { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify({
      name: entry.name,
      peerDependencies: Object.fromEntries((entry.declares ?? []).map(name => [name, 'workspace:*'])),
    }))
    if (entry.source !== undefined) writeFileSync(join(directory, 'src', 'index.ts'), entry.source)
  }
  return root
}

describe('the repository scan', () => {
  it('reads each package once, with everything its sections declare', () => {
    const root = repository([{ name: '@lyness/lyn-a', declares: ['@lyness/lyn-b'] }, { name: '@lyness/lyn-b' }])
    const found = workspacePackages(root)
    expect(found.map(entry => entry.name)).toEqual(['@lyness/lyn-a', '@lyness/lyn-b'])
    expect([...(found[0]?.declared ?? [])].sort()).toEqual(['@lyness/lyn-a', '@lyness/lyn-b'])
  })

  it('reports an empty corpus rather than passing silently', () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-undeclared-empty-'))
    roots.push(root)
    expect(undeclaredWorkspaceImports(root)).toEqual([`${root}: no workspace package manifests found`])
  })
})

describe('what counts as a runtime import', () => {
  it('counts a value import, a re-export, and a bare import; not a type-only one', () => {
    const found = runtimePackageImports('probe.ts', [
      "import { one } from '@lyness/lyn-value'",
      "import '@lyness/lyn-bare'",
      "export { two } from '@lyness/lyn-reexport'",
      "import type { Three } from '@lyness/lyn-type'",
      "import type {} from '@lyness/lyn-merge'",
      "export type { Four } from '@lyness/lyn-type-reexport'",
      "import { four } from './local.ts'",
      "const five = '@lyness/lyn-in-a-string'",
    ].join('\n'))
    expect(found.map(use => use.name))
      .toEqual(['@lyness/lyn-value', '@lyness/lyn-bare', '@lyness/lyn-reexport'])
    expect(found.map(use => use.line)).toEqual([1, 2, 3])
  })

  it('names the package of a subpath import, and ignores an unscoped bare one', () => {
    const found = runtimePackageImports('probe.ts', [
      "import { deep } from '@lyness/lyn-session/types'",
      "import { zod } from 'zod'",
    ].join('\n'))
    expect(found.map(use => use.name)).toEqual(['@lyness/lyn-session'])
  })
})

describe('the verdict', () => {
  it('accepts a package that declares what its source imports', () => {
    const root = repository([
      { name: '@lyness/lyn-a', declares: ['@lyness/lyn-b'], source: "import { b } from '@lyness/lyn-b'\n" },
      { name: '@lyness/lyn-b', source: 'export const b = 1\n' },
    ])
    expect(undeclaredWorkspaceImports(root)).toEqual([])
  })

  it('refuses a runtime import of a workspace package the importer does not declare', () => {
    // This is the `session-controller` → `request-principal` defect: the import
    // resolves from a hoisted root install and fails from the package itself.
    const root = repository([
      { name: '@lyness/lyn-a', source: "import { b } from '@lyness/lyn-b'\n" },
      { name: '@lyness/lyn-b', source: 'export const b = 1\n' },
    ])
    expect(undeclaredWorkspaceImports(root)).toEqual([
      'packages/group/p0/src/index.ts:1: imports @lyness/lyn-b at runtime, which @lyness/lyn-a does not declare',
    ])
  })

  it('leaves an undeclared type-only import alone, and a third-party one', () => {
    const root = repository([
      {
        name: '@lyness/lyn-a',
        source: "import type { B } from '@lyness/lyn-b'\nimport { z } from 'zod'\nexport type { B }\n",
      },
      { name: '@lyness/lyn-b', source: 'export interface B { one: string }\n' },
    ])
    expect(undeclaredWorkspaceImports(root)).toEqual([])
  })

  it('says nothing about a package outside this workspace', () => {
    const root = repository([{ name: '@lyness/lyn-a', source: "import { x } from '@elsewhere/thing'\n" }])
    expect(undeclaredWorkspaceImports(root)).toEqual([])
  })
})
