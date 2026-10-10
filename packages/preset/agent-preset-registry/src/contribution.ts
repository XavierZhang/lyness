/**
 * Rows a module bundle adds to presets it does not own.
 *
 * A preset is one row whose `config.plugins` holds the whole list, and a patch
 * replaces a targeted row's whole config, so a module bundle cannot add one
 * tool to a preset by patching it. It contributes the row instead, and the
 * registry merges contributions into every preset that accepts them.
 * @module @lyness/lyn-agent-preset-registry/contribution
 */

import type { PresetDefinition } from './definition.ts'

/** One plugin row a module bundle contributes. */
export type ContributedRow = PresetDefinition['plugins'][number]

/**
 * Central order allocation for contributed rows.
 *
 * The tool catalog's order is part of the request prefix, so two deployments
 * with the same modules switched on have to produce the same catalog in the
 * same order. Arrival order cannot decide that: the ordered bundle list is a
 * deployment's own choice. A row id absent from this table has no allocated
 * position and is refused.
 */
export const CONTRIBUTION_ORDERS = {
  'module-memory-tools': 100,
  'module-terminal-tool': 200,
  'module-lsp-tool': 300,
  'module-computer-use-tool': 400,
  'module-browser-use-tool': 500,
  'module-deliverables-tool': 600,
  'module-extensions-tool': 700,
} as const

/** Row id with a centrally allocated position. */
export type ContributionId = keyof typeof CONTRIBUTION_ORDERS

/** One registered contribution, with the module that owns it. */
export interface PresetContribution {
  /** The centrally allocated row id; also the row's `id` in the preset. */
  readonly id: ContributionId
  /** The module bundle contributing it, for a diagnostic that names a culprit. */
  readonly module: string
  /** The plugin row to merge, without its id. */
  readonly row: Omit<ContributedRow, 'id'>
}

/**
 * Whether a row id carries a central allocation.
 * @param id - candidate row id.
 * @returns true when {@link CONTRIBUTION_ORDERS} allocates it.
 */
export function isContributionId(id: string): id is ContributionId {
  return Object.hasOwn(CONTRIBUTION_ORDERS, id)
}

/**
 * Merge contributions into one preset's plugin list.
 *
 * Contributions follow the preset's own rows, in allocated order, so a
 * deployment's bundle order cannot move them.
 * @param plugins - the preset's declared rows.
 * @param contributions - registered contributions, in registration order.
 * @returns the complete row list to mount.
 * @throws {Error} when two contributions claim one row id, naming both modules.
 */
export function mergeContributions(
  plugins: PresetDefinition['plugins'],
  contributions: readonly PresetContribution[],
): PresetDefinition['plugins'] {
  const byId = new Map<ContributionId, PresetContribution>()
  for (const contribution of contributions) {
    const existing = byId.get(contribution.id)
    if (existing !== undefined) {
      throw new Error(
        `preset contribution "${contribution.id}" is claimed by both ${existing.module} and ${contribution.module}`,
      )
    }
    byId.set(contribution.id, contribution)
  }
  const declared = new Set(plugins.flatMap(row => row.id === undefined ? [] : [row.id]))
  for (const id of byId.keys()) {
    if (declared.has(id)) throw new Error(`preset contribution "${id}" collides with a row the preset declares`)
  }
  const merged = [...byId.values()]
    .sort((left, right) => CONTRIBUTION_ORDERS[left.id] - CONTRIBUTION_ORDERS[right.id])
    .map(contribution => ({ ...contribution.row, id: contribution.id }))
  return [...plugins, ...merged]
}
