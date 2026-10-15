/**
 * REAL-composition coverage for the allowance a deployment gets without
 * stating one: a test-only cordis.yml booted through the vendored Loader
 * mounts the ledger row with no config, reads a balance, and the daily grant
 * is the shipped 500.
 *
 * It is a composed boot rather than a unit test because the number a
 * deployment actually gets depends on config reaching the ledger through the
 * Loader, and a hand-built `ctx.plugin(..., {})` supplies that config itself.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import Storage from '@lyness/lyn-storage'
import * as StorageJson from '@lyness/lyn-storage-json'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import * as StoredCreditLedger from '../src/store.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

it('grants the shipped daily allowance when a deployment states none', async () => {
  root = await mkdtemp(join(tmpdir(), 'lyn-credits-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@lyness/lyn-storage'",
    "- name: '@lyness/lyn-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@lyness/lyn-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@lyness/lyn-credits/store'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@lyness/lyn-storage', Storage],
    ['@lyness/lyn-storage-json', StorageJson],
    ['@lyness/lyn-storage-domain', StorageDomain],
    ['@lyness/lyn-credits/store', StoredCreditLedger],
  ])
  const base = context.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  // A copy with `import` replaced, rather than a mutation: the internal
  // loader is cached process-wide, so changing it would reroute every other
  // spec in this worker. Nothing else on it is called during the boot.
  context.loader.internal = {
    ...base,
    import: (specifier: string) => {
      const found = modules.get(specifier)
      if (found === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(found)
    },
  }
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()

  const balance = await context.credits.balance(brandString<PersonId>('ada'))
  expect(balance.available).toBe(500)
})
