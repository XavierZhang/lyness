/**
 * What modes the shipped Web composition puts in front of a person.
 *
 * This fork packages the agent modes as two views — `work` for everyday work
 * and `build` for development — and keeps the four ids the official modes use
 * registered but unoffered, because a session recorded under one of those ids
 * has to reopen with it. Both halves of that packaging live in patch files, and
 * both have been reverted by an upstream merge before: 0.2.2 put `default` back
 * to `standard`, which placed an unoffered mode in front of every new user, and
 * the only test that would have caught it runs in the real-API lane. These
 * cases read the shipped patch files, so they fail on the next revert.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@lyness/cordis-plugin-include'

const root = fileURLToPath(new URL('..', import.meta.url))

/** The ids this fork offers a person starting a task, in the order the chooser shows them. */
const OFFERED = ['work', 'build']

/** The ids the official modes use: registered, resolvable, and not offered. */
const OFFICIAL = ['standard', 'ptc', 'minimal', 'cordis']

/** One inserted row, with its `!!js` expressions still unevaluated. */
interface Row {
  id?: string
  name?: string
  config?: Record<string, unknown>
}

/** Every row the shipped Web patch files insert, in `lyn.bundle.patch` order. */
function shippedRows(): Row[] {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    lyn?: { bundle?: { patch?: string | string[] } }
  }
  const patch = manifest.lyn?.bundle?.patch
  if (patch === undefined) throw new Error('lyn-web-app declares no lyn.bundle.patch')
  const files = typeof patch === 'string' ? [patch] : patch
  return files.flatMap((file) => {
    const parsed = yaml.load(readFileSync(resolve(root, file), 'utf8'), { schema: entryListSchema })
    return (parsed as { insert?: Row[] }[]).flatMap(entry => entry.insert ?? [])
  })
}

/** Every `@lyness/lyn-agent-preset` declaration the bundle ships, by preset id. */
function declarations(): Map<string, Record<string, unknown>> {
  const found = new Map<string, Record<string, unknown>>()
  for (const row of shippedRows()) {
    if (row.name !== '@lyness/lyn-agent-preset' || row.config === undefined) continue
    const id = row.config['id']
    if (typeof id === 'string') found.set(id, row.config)
  }
  return found
}

/** The preset-selection registry row. */
function registry(): Record<string, unknown> {
  const row = shippedRows().find(entry => entry.name === '@lyness/lyn-agent-preset-registry')
  if (row?.config === undefined) throw new Error('the shipped Web patch declares no agent-preset-registry row')
  return row.config
}

describe('the modes the shipped Web composition offers', () => {
  it('declares the two views and keeps the four official ids registered', () => {
    expect([...declarations().keys()].sort()).toEqual([...OFFERED, ...OFFICIAL].sort())
  })

  it('offers only the two views', () => {
    const offered = [...declarations()]
      .filter(([, config]) => config['offered'] !== false)
      .map(([id]) => id)
    expect(offered.sort()).toEqual([...OFFERED].sort())
    for (const id of OFFICIAL) {
      expect(declarations().get(id)?.['offered'], id).toBe(false)
    }
  })

  it('shows the two views first, so the chooser opens on them', () => {
    const order = [...declarations()]
      .map(([id, config]) => ({ id, order: config['order'] }))
      .sort((left, right) => Number(left.order) - Number(right.order))
    expect(order.slice(0, OFFERED.length).map(entry => entry.id)).toEqual(OFFERED)
    // Every declaration states its place rather than relying on file order.
    for (const entry of order) expect(typeof entry.order, entry.id).toBe('number')
  })

  it('composes a new session from an offered view, not from an unoffered mode', () => {
    // The regression this file exists for: a default pointing at `standard`
    // means the first task every new user runs is a mode the chooser does not
    // even list.
    const chosen = registry()['default']
    expect(chosen).toBe('work')
    expect(declarations().get(String(chosen))?.['offered']).not.toBe(false)
  })

  it('lets a module bundle contribute rows into the two views only', () => {
    // Contributions land in the presets that serve people; the official four
    // stay as upstream shipped them, which is what keeps their recorded
    // sessions reproducible.
    for (const id of OFFERED) expect(declarations().get(id)?.['acceptsContributions'], id).toBe(true)
    for (const id of OFFICIAL) expect(declarations().get(id)?.['acceptsContributions'], id).toBeUndefined()
  })
})
