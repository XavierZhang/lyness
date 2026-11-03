/**
 * How the tool registry's own entries become the two lists a reader sees.
 *
 * Its own unit because the rules are the whole answer and are worth reading
 * on their own: an MCP server's tools are its connection rather than four
 * loose tools, and who gave a tool is decided by comparing the scope's view
 * with the deployment's rather than by any field a registration carries.
 *
 * @module @lyness/lyn-api-agent-capabilities-controller/project
 */

import type { ToolDefinition } from '@lyness/lyn-tools'
import type { CapabilitySource, ConnectionAvailabilityView, ToolAvailabilityView } from './types.ts'

/** Prefix `lyn-mcp-client` gives every tool it registers for one server. */
export const MCP_TOOL_PREFIX = 'mcp__'

/**
 * The MCP server one tool name belongs to.
 *
 * `lyn-mcp-client` names each tool `mcp__<server>__<raw>`, so the server is
 * the segment between the two separators. A name carrying the prefix without
 * a second separator is not one that package wrote, and is reported as an
 * ordinary tool rather than attributed to a server nobody configured.
 * @param name - the tool's model-facing name.
 * @returns the server name, or undefined for a tool that is not an MCP tool.
 */
export function serverOfToolName(name: string): string | undefined {
  if (!name.startsWith(MCP_TOOL_PREFIX)) return undefined
  const rest = name.slice(MCP_TOOL_PREFIX.length)
  const at = rest.indexOf('__')
  return at <= 0 ? undefined : rest.slice(0, at)
}

/**
 * Who made one capability available.
 * @param name - the tool's name.
 * @param fromDeployment - names the deployment-wide view carries.
 * @returns the deployment when it carries the name, otherwise the preset.
 */
function sourceOf(name: string, fromDeployment: ReadonlySet<string>): CapabilitySource {
  return fromDeployment.has(name) ? 'deployment' : 'preset'
}

/**
 * The tools a reader sees as tools, in name order.
 *
 * An MCP server's tools are left out: they are reported as that connection,
 * because a reader deciding whether they may reach a system cares about the
 * system rather than about its four verbs.
 * @param available - the definitions the viewing scope sees.
 * @param fromDeployment - names the deployment-wide view carries.
 * @returns one row per non-MCP tool, sorted by name.
 */
export function toolsOf(
  available: readonly ToolDefinition[],
  fromDeployment: ReadonlySet<string>,
): readonly ToolAvailabilityView[] {
  return available
    .filter(one => serverOfToolName(one.name) === undefined)
    .map((one): ToolAvailabilityView => ({
      name: one.name,
      description: one.description,
      source: sourceOf(one.name, fromDeployment),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The MCP servers a reader sees, in name order.
 *
 * A server is attributed to the preset when any of its tools is, because a
 * server the deployment did not compose is one the preset brought.
 * @param available - the definitions the viewing scope sees.
 * @param fromDeployment - names the deployment-wide view carries.
 * @returns one row per server, sorted by name.
 */
export function connectionsOf(
  available: readonly ToolDefinition[],
  fromDeployment: ReadonlySet<string>,
): readonly ConnectionAvailabilityView[] {
  const counts = new Map<string, { tools: number; source: CapabilitySource }>()
  for (const one of available) {
    const server = serverOfToolName(one.name)
    if (server === undefined) continue
    const seen = counts.get(server)
    const source = sourceOf(one.name, fromDeployment)
    if (seen === undefined) counts.set(server, { tools: 1, source })
    else counts.set(server, { tools: seen.tools + 1, source: seen.source === 'preset' ? 'preset' : source })
  }
  return [...counts.entries()]
    .map(([server, seen]): ConnectionAvailabilityView => ({ server, tools: seen.tools, source: seen.source }))
    .sort((a, b) => a.server.localeCompare(b.server))
}
