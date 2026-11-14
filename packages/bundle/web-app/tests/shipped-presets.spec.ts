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
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { inheritedPlugins, type PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'

const root = fileURLToPath(new URL('..', import.meta.url))

/** The ids this fork offers a person starting a task, in the order the chooser shows them. */
const OFFERED = ['work', 'build']

/** The ids the official modes use: registered, resolvable, and not offered. */
const OFFICIAL = ['standard', 'ptc', 'minimal', 'cordis']

/** The official mode each view draws its capabilities from. */
const BASES: Record<string, string> = { work: 'standard', build: 'cordis' }

/** One inserted row, with its `!!js` expressions still unevaluated. */
interface Row {
  id?: string
  name?: string
  config?: Record<string, unknown>
}

/** Every row the shipped Web patch files insert, in `dsh.bundle.patch` order. */
function shippedRows(): Row[] {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    dsh?: { bundle?: { patch?: string | string[] } }
  }
  const patch = manifest.dsh?.bundle?.patch
  if (patch === undefined) throw new Error('dsh-web-app declares no dsh.bundle.patch')
  const files = typeof patch === 'string' ? [patch] : patch
  return files.flatMap((file) => {
    const parsed = yaml.load(readFileSync(resolve(root, file), 'utf8'), { schema: entryListSchema })
    return (parsed as { insert?: Row[] }[]).flatMap(entry => entry.insert ?? [])
  })
}

/** Every `@deepseek-ai/dsh-agent-preset` declaration the bundle ships, by preset id. */
function declarations(): Map<string, Record<string, unknown>> {
  const found = new Map<string, Record<string, unknown>>()
  for (const row of shippedRows()) {
    if (row.name !== '@deepseek-ai/dsh-agent-preset' || row.config === undefined) continue
    const id = row.config['id']
    if (typeof id === 'string') found.set(id, row.config)
  }
  return found
}

/**
 * The plugin rows one preset declares itself, without what it extends.
 * @param id - the preset id.
 * @returns its declared rows.
 */
function rowsOf(id: string): Row[] {
  const rows = declarations().get(id)?.['plugins']
  return Array.isArray(rows) ? rows as Row[] : []
}

/**
 * The same rows, typed the way the registry's resolver takes them.
 * @param id - the preset id.
 * @returns its declared rows.
 */
function declaredPlugins(id: string): PresetDefinition['plugins'] {
  const rows = declarations().get(id)?.['plugins']
  return Array.isArray(rows) ? rows as PresetDefinition['plugins'] : []
}

/** The preset-selection registry row. */
function registry(): Record<string, unknown> {
  const row = shippedRows().find(entry => entry.name === '@deepseek-ai/dsh-agent-preset-registry')
  if (row?.config === undefined) throw new Error('the shipped Web patch declares no agent-preset-registry row')
  return row.config
}

/**
 * One view's complete row list, resolved the way the registry resolves it.
 * @param id - the view's preset id.
 * @returns every row the view mounts, inherited rows included.
 */
function effectiveRows(id: string): PresetDefinition['plugins'] {
  const definition = (declared: string): PresetDefinition | undefined => {
    const config = declarations().get(declared)
    if (config === undefined) return undefined
    const base = config['extends']
    return { id: declared, plugins: declaredPlugins(declared), ...(typeof base === 'string' ? { extends: base } : {}) }
  }
  const own = definition(id)
  if (own === undefined) throw new Error(`the shipped Web patch declares no preset "${id}"`)
  return inheritedPlugins(own, definition)
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

  it('draws each view from an official mode instead of restating it', () => {
    // A restated composition keeps whatever the rows were on the day it was
    // copied: both views carried a plan-mode prompt and subagent options two
    // upstream releases old, with nothing failing. Extending the mode is what
    // makes an upstream capability reach the view with no edit here.
    for (const [view, base] of Object.entries(BASES)) {
      expect(declarations().get(view)?.['extends'], view).toBe(base)
      expect(declarations().has(base), base).toBe(true)
    }
  })

  it('keeps each view\'s restated rows identical to the mode\'s, the view\'s own fields aside', () => {
    // A replacement row replaces the whole row, so a view restating one
    // carries a copy of every field it does not mean to change. These are
    // the only such rows; this case fails when one drifts from its base.
    for (const [view, base] of Object.entries(BASES)) {
      const persona = rowsOf(view).find(row => row.id === 'persona')
      const inherited = rowsOf(base).find(row => row.id === 'persona')
      expect(persona?.config?.['prefix'], view).toBe(inherited?.config?.['prefix'])
      expect(persona?.config?.['suffix'], view).toBe('Your working directory is {{cwd}}.')
      const restated = rowsOf(view).filter(row => inherited !== undefined && rowsOf(base).some(entry => entry.id === row.id))
      expect(restated.map(row => row.id), view).toEqual(view === 'work' ? ['persona', 'tool-plugin-manager'] : ['persona'])
    }
  })

  it('gives each view the capabilities its base mode carries', () => {
    // What the packaging is for: the view a person picks runs the official
    // mode's capabilities. Restating the rows lost four of these for two
    // upstream releases, with nothing failing, so they are named here.
    const work = effectiveRows('work').map(row => row.id)
    for (const row of ['time-context', 'tool-schedule', 'present', 'tool-session-query', 'planning', 'compaction', 'delegation']) {
      expect(work, row).toContain(row)
    }
    // `build` is the development view: the authoring tool is what separates it.
    expect(effectiveRows('build').map(row => row.id)).toContain('tool-cordis')
    expect(work).not.toContain('tool-cordis')
    // One invocation form per agent, taken from the deployment: a view that
    // mounted an executor of its own would override that choice.
    for (const view of ['work', 'build']) {
      expect(effectiveRows(view).map(row => row.name), view)
        .not.toContain('@deepseek-ai/dsh-tool-executor-ptc')
    }
  })

  it('points the plugin-authoring flow at a view it offers', () => {
    // The entries that start that flow hide while their preset is absent from
    // the roster, so an unoffered id leaves every one of them dead.
    const row = shippedRows().find(entry => entry.name === '@deepseek-ai/dsh-client-ui-agent-preset')
    const configured = row?.config?.['authoringPreset']
    expect(configured).toBe('build')
    expect(declarations().get(String(configured))?.['offered']).not.toBe(false)
  })

  it('lets a module bundle contribute rows into the two views only', () => {
    // Contributions land in the presets that serve people; the official four
    // stay as upstream shipped them, which is what keeps their recorded
    // sessions reproducible.
    for (const id of OFFERED) expect(declarations().get(id)?.['acceptsContributions'], id).toBe(true)
    for (const id of OFFICIAL) expect(declarations().get(id)?.['acceptsContributions'], id).toBeUndefined()
  })
})
