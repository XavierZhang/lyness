/** Declarative preset configuration and YAML validation. */
import type { EntryOptions, JsExpr } from '@lyness/cordis-plugin-loader'

/** Identity, display fields and child Cordis plugins of one preset. */
export interface PresetDefinition {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly order?: number
  readonly plugins: readonly (Omit<EntryOptions, 'id' | 'disabled'> & { id?: string; disabled?: EntryOptions['disabled'] | JsExpr })[]
  /**
   * The preset whose rows this one starts from, by id.
   *
   * Without it a preset declares its whole composition. With it, `plugins`
   * holds only the difference: a row whose id matches one of the base's
   * replaces it in place, and any other row follows the base's list. This is
   * what keeps the two views this fork offers drawing on the official modes
   * instead of copying them — a copy silently keeps whatever the prompt,
   * tool set, and subagent configuration were on the day it was made, which
   * is how `work` and `build` came to carry a plan-mode prompt and subagent
   * options two upstream releases old ([ledger](../../../../CUSTOM.md)).
   */
  readonly extends?: string
  /**
   * Whether module bundles may contribute rows into this preset. The presets
   * that serve people declare it; the four ids the official modes use do not,
   * which is what keeps them as upstream shipped them.
   */
  readonly acceptsContributions?: boolean
  /**
   * Whether a person starting a task is offered this preset. Absent means
   * offered.
   *
   * The four ids the official modes use declare `false`: this fork packages
   * them as two views a person chooses between, and a chooser offering six
   * overlapping modes is the cost that packaging exists to remove. They stay
   * registered rather than withdrawn, because a session recorded under one of
   * those ids has to reopen with it ([ledger](../../../../CUSTOM.md)).
   */
  readonly offered?: boolean
}

/** Validate a parsed Cordis entry list, including nested groups.
 * @param rows Parsed YAML value.
 * @param at Diagnostic prefix.
 * @returns The first invalid row, or undefined.
 */
export function entryListProblem(rows: unknown, at = ''): string | undefined {
  if (!Array.isArray(rows)) {
    return at === ''
      ? 'the composition must be a top-level list of plugin rows'
      : `group ${at} must hold a list of plugin rows`
  }
  for (const [index, row] of rows.entries()) {
    const label = at === '' ? `row ${String(index + 1)}` : `${at} row ${String(index + 1)}`
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return `${label} is not a plugin row (expected a map with a "name")`
    }
    const { name, group, config } = row as { name?: unknown; group?: unknown; config?: unknown }
    if (typeof name !== 'string' || name === '') {
      return `${label} names no plugin (a "name" string is required)`
    }
    if (group === true) {
      const nested = entryListProblem(config, label)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

/**
 * One preset's complete row list, resolved through what it extends.
 *
 * The chain is walked to its root and applied downwards, so a view extending
 * a view behaves like the single overlay it reads as.
 * @param definition - the preset whose rows are wanted.
 * @param declaration - looks a preset's declaration up by id.
 * @returns the base's rows with this preset's own overlaid.
 * @throws {Error} when a base is not registered, or the chain is circular.
 */
export function inheritedPlugins(
  definition: PresetDefinition,
  declaration: (id: string) => PresetDefinition | undefined,
): PresetDefinition['plugins'] {
  const chain: PresetDefinition[] = []
  const seen = new Set<string>()
  let current = definition
  for (;;) {
    if (seen.has(current.id)) {
      throw new Error(`preset "${definition.id}" extends itself through ${[...seen].join(' -> ')}`)
    }
    seen.add(current.id)
    chain.unshift(current)
    const baseId = current.extends
    if (baseId === undefined) break
    const base = declaration(baseId)
    if (base === undefined) {
      throw new Error(`preset "${current.id}" extends "${baseId}", which no declaration registers`)
    }
    current = base
  }
  const [root, ...derived] = chain
  // `chain` always holds `definition` itself, so the root is never absent.
  let rows = root?.plugins ?? definition.plugins
  for (const entry of derived) rows = overlayRows(rows, entry.plugins)
  return rows
}

/**
 * Apply one preset's own rows over the rows it inherits.
 * @param base - the inherited rows, in their own order.
 * @param own - the rows the extending preset declares.
 * @returns replacements in place, then every row the base does not carry.
 */
function overlayRows(
  base: PresetDefinition['plugins'],
  own: PresetDefinition['plugins'],
): PresetDefinition['plugins'] {
  const replacements = new Map(own.flatMap(row => row.id === undefined ? [] : [[row.id, row] as const]))
  const replaced = new Set<string>()
  const merged = base.map((row) => {
    if (row.id === undefined) return row
    const replacement = replacements.get(row.id)
    if (replacement === undefined) return row
    replaced.add(row.id)
    return replacement
  })
  return [...merged, ...own.filter(row => row.id === undefined || !replaced.has(row.id))]
}
