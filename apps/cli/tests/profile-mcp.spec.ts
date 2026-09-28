/** MCP resource ownership across the resolved shipped profile templates. */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeEntries, loadProfile, PROFILE_TEMPLATES } from '@lyness/lyn-app-boot'

const installAnchor = fileURLToPath(new URL('../package.json', import.meta.url))
const resourcePackage = '@lyness/lyn-mcp-resources'

describe('shipped MCP resource composition', () => {
  // brand-studio is excluded: it is a one-row standalone command tree that
  // mounts no model, session, or Web row, so it carries no agent for an MCP
  // resource consumer to serve. Its own patch states that design.
  it.each(Object.keys(PROFILE_TEMPLATES).filter(name => name !== 'brand-studio'))(
    '%s carries one shared resource consumer without a server', (name) => {
      const home = mkdtempSync(join(tmpdir(), 'lyn-profile-mcp-'))
      try {
        const profile = loadProfile('lyn', name, installAnchor, home)
        const warnings: string[] = []
        const rows = composeEntries([
          ...profile.layers.map(layer => layer.patches),
          profile.patches,
        ], message => warnings.push(message))

        expect(rows.filter(row => row.name === resourcePackage)).toEqual([
          { id: 'mcp-resources', name: resourcePackage },
        ])
        expect(rows.filter(row => row.name === '@lyness/lyn-mcp-client')).toEqual([])
        expect(warnings).toEqual([])

        const owners = profile.layers.filter((layer) => {
          const manifest = JSON.parse(readFileSync(join(layer.packageDir, 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>
          }
          return manifest.dependencies?.[resourcePackage] !== undefined
        })
        expect(owners.map(owner => owner.packageName)).toEqual([
          name === 'sdk-minimal' ? '@lyness/lyn-sdk-minimal' : '@lyness/lyn-base',
        ])
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    })
})
