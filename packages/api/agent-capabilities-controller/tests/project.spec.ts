/**
 * How the tool registry's entries become the two lists a reader sees: an MCP
 * server reported as its connection, and who gave each capability decided by
 * comparing the scope's view with the deployment's.
 */

import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@lyness/lyn-tools'
import { MCP_TOOL_PREFIX, connectionsOf, serverOfToolName, toolsOf } from '../src/project.ts'

/** One definition with only the fields this projection reads. */
function tool(name: string, description = ''): ToolDefinition {
  return { name, description } as ToolDefinition
}

describe('serverOfToolName', () => {
  it('reads the server out of the name lyn-mcp-client writes', () => {
    expect(serverOfToolName(`${MCP_TOOL_PREFIX}acme__search`)).toBe('acme')
    expect(serverOfToolName(`${MCP_TOOL_PREFIX}acme__deep__nested`)).toBe('acme')
  })

  it('claims no server for a name that package did not write', () => {
    // No prefix, nothing between the separators, and a prefix with no second
    // separator: attributing any of these would name a server nobody
    // configured.
    for (const name of ['bash', `${MCP_TOOL_PREFIX}__search`, `${MCP_TOOL_PREFIX}acme`]) {
      expect(serverOfToolName(name)).toBeUndefined()
    }
  })
})

describe('toolsOf', () => {
  it('reports the non-MCP tools in name order with their description', () => {
    const available = [tool('write', 'Write a file.'), tool('bash', 'Run a command.')]
    expect(toolsOf(available, new Set(['write', 'bash']))).toEqual([
      { name: 'bash', description: 'Run a command.', source: 'deployment' },
      { name: 'write', description: 'Write a file.', source: 'deployment' },
    ])
  })

  it('attributes a tool the deployment view does not carry to the preset', () => {
    expect(toolsOf([tool('ralph')], new Set(['bash']))).toEqual([
      { name: 'ralph', description: '', source: 'preset' },
    ])
  })

  it('leaves an MCP server tools out, because they are reported as its connection', () => {
    expect(toolsOf([tool(`${MCP_TOOL_PREFIX}acme__search`)], new Set())).toEqual([])
  })
})

describe('connectionsOf', () => {
  it('counts one row per server, in name order', () => {
    const available = [
      tool(`${MCP_TOOL_PREFIX}zeta__one`),
      tool(`${MCP_TOOL_PREFIX}acme__one`),
      tool(`${MCP_TOOL_PREFIX}acme__two`),
      tool('bash'),
    ]
    const deployment = new Set(available.map(one => one.name))
    expect(connectionsOf(available, deployment)).toEqual([
      { server: 'acme', tools: 2, source: 'deployment' },
      { server: 'zeta', tools: 1, source: 'deployment' },
    ])
  })

  it('attributes a server to the preset when any of its tools is the preset own', () => {
    const available = [tool(`${MCP_TOOL_PREFIX}acme__one`), tool(`${MCP_TOOL_PREFIX}acme__two`)]
    // A server the deployment did not compose is one the preset brought, and
    // one tool of it suffices to say so.
    expect(connectionsOf(available, new Set([`${MCP_TOOL_PREFIX}acme__one`]))).toEqual([
      { server: 'acme', tools: 2, source: 'preset' },
    ])
  })

  it('keeps a server attributed to the preset once one of its tools is', () => {
    const available = [tool(`${MCP_TOOL_PREFIX}acme__one`), tool(`${MCP_TOOL_PREFIX}acme__two`)]
    // The preset's own tool comes first here and the deployment's second, so
    // the later row must not talk the attribution back down.
    expect(connectionsOf(available, new Set([`${MCP_TOOL_PREFIX}acme__two`]))).toEqual([
      { server: 'acme', tools: 2, source: 'preset' },
    ])
  })

  it('reports no connection when nothing is namespaced under a server', () => {
    expect(connectionsOf([tool('bash')], new Set(['bash']))).toEqual([])
  })
})
