/**
 * The bundle's substance is its patch file: the rows that touch a machine,
 * each shell stack gated by platform so exactly one mounts per host.
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@lyness/cordis-plugin-include'
import { evaluate } from '@lyness/cordis-plugin-loader'

describe('lyn-module-execution bundle', () => {
  it('declares a parseable patch list through the lyn.bundle.patch manifest field', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      lyn?: { bundle?: { patch?: string } }
    }
    expect(manifest.lyn?.bundle?.patch).toBe('./cordis.patch.yml')
    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.lyn!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    )
    expect(Array.isArray(parsed)).toBe(true)
  })

  it('mounts every row that reaches the machine, and each one declares its package', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const parsed = yaml.load(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
    if (!Array.isArray(parsed)) throw new TypeError('patch must parse to a patch list')
    const rows = parsed.flatMap((patch): Record<string, unknown>[] =>
      typeof patch === 'object' && patch !== null && Array.isArray((patch as { insert?: unknown[] }).insert)
        ? (patch as { insert: Record<string, unknown>[] }).insert
        : [])
    // The providers and the tools that inject them ship together: a profile
    // selecting this bundle gets a complete execution plane, never half of one.
    for (const id of [
      'subprocess', 'sandbox', 'sandbox-policy', 'bash-sandbox', 'pwsh-sandbox', 'shell-env',
      'tool-bash', 'tool-pwsh', 'fs-sandbox', 'fs-observation-policy', 'tool-fs', 'tool-fs-search',
      'ptc-runtime', 'workflow-ptc', 'tool-workflow', 'tool-ralph',
    ]) {
      const row = rows.find(candidate => candidate.id === id)
      if (row === undefined) throw new Error(`patch must mount ${id}`)
      // The cold-start closure resolves each bare plugin name from this
      // package's own dependencies.
      expect(manifest.dependencies, `dependency for ${id}`).toHaveProperty(String(row.name))
    }
  })

  it('gates each shell stack by platform with a symmetric disabled expression', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const parsed = yaml.load(
      readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(parsed)) throw new TypeError('base patch must parse to a patch list')
    const rows = parsed.flatMap((patch): Record<string, unknown>[] =>
      typeof patch === 'object' && patch !== null
        ? (patch as { insert?: Record<string, unknown>[] }).insert ?? []
        : [],
    )
    // Symmetric gating: each stack's executor and tool rows carry the same
    // platform fact, inverted between the bash and pwsh twins, so exactly one
    // shell stack mounts per host. Evaluate with a platform-scoped context
    // (the `with` scope shadows the global `process`) so both outcomes pin on
    // every host.
    for (const [id, win32, linux] of [
      ['bash-sandbox', true, false],
      ['tool-bash', true, false],
      ['pwsh-sandbox', false, true],
      ['tool-pwsh', false, true],
    ] as const) {
      const row = rows.find(candidate => candidate.id === id)
      if (row === undefined) throw new Error(`base patch must mount ${id}`)
      const expression = (row.disabled as { __jsExpr?: string } | undefined)?.__jsExpr
      if (expression === undefined) throw new Error(`${id} must gate on a !!js disabled expression`)
      expect(Boolean(evaluate({ process: { platform: 'win32' } }, expression)), `${id} on win32`).toBe(win32)
      expect(Boolean(evaluate({ process: { platform: 'linux' } }, expression)), `${id} on linux`).toBe(linux)
    }
    // The platform layer folded into these rows: no separate patch file ships.
    expect(existsSync(resolve(root, 'windows.cordis.patch.yml'))).toBe(false)
  })
})
