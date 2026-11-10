/**
 * How the tool registry's entries become the two lists a reader sees: an MCP
 * server reported as its connection, and who gave each capability decided by
 * comparing the scope's view with the deployment's.
 */

import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@lyness/lyn-tools'
import { MCP_TOOL_PREFIX, connectionsOf, serverOfToolName, toolsOf } from '../src/project.ts'
import type { ToolOrigin } from '../src/project.ts'

/** One definition with only the fields this projection reads. */
function tool(name: string, description = ''): ToolDefinition {
  return { name, description } as ToolDefinition
}

/** One tool with where it came from, as the controller resolves it. */
function from(name: string, plugin: string, extra: Partial<ToolOrigin> = {}): ToolOrigin {
  return { name, plugin, ...extra }
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
  it('reports one row per plugin, in plugin order, naming the tools it registered', () => {
    // Five tools from one package are one capability a person recognizes, so
    // what a row names is the plugin; the tool names ride along because a
    // task shows them.
    const available = [
      from('write', 'tool-fs', { module: '@acme/lyn-tool-fs' }),
      from('bash', 'tool-bash', { module: '@acme/lyn-tool-bash' }),
      from('read', 'tool-fs', { module: '@acme/lyn-tool-fs' }),
    ]
    expect(toolsOf(available, new Set(['write', 'bash', 'read']))).toEqual([
      { plugin: 'tool-bash', tools: ['bash'], source: 'deployment' },
      { plugin: 'tool-fs', tools: ['read', 'write'], source: 'deployment' },
    ])
  })

  it('carries the package\'s own localized metadata when the deployment could read it', () => {
    const meta = { title: { en: 'Files', zh: '文件' } }
    expect(toolsOf([from('read', 'tool-fs', { module: '@acme/lyn-tool-fs', meta })], new Set(['read'])))
      .toEqual([{ plugin: 'tool-fs', tools: ['read'], source: 'deployment', meta }])
  })

  it('attributes a group to the preset as soon as one of its tools is the preset\'s', () => {
    const available = [from('read', 'tool-fs'), from('ralph', 'tool-fs')]
    expect(toolsOf(available, new Set(['read']))).toEqual([
      { plugin: 'tool-fs', tools: ['ralph', 'read'], source: 'preset' },
    ])
  })

  it('groups by composition entry, so two plugins calling themselves the same stay apart', () => {
    const available = [
      from('read', 'tool-fs', { module: '@acme/lyn-tool-fs' }),
      from('peek', 'tool-fs', { module: '@other/lyn-tool-fs' }),
    ]
    expect(toolsOf(available, new Set(['read', 'peek'])).map(group => group.tools))
      .toEqual([['read'], ['peek']])
  })

  it('leaves an MCP server tools out, because they are reported as its connection', () => {
    expect(toolsOf([from(`${MCP_TOOL_PREFIX}acme__search`, 'mcp-client')], new Set())).toEqual([])
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
