/** The optional Developer Tools bundle enables both inspectors, including fetch capture. */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEntryYaml } from '@lyness/cordis-plugin-include'

describe('Inspector profile bundle', () => {
  it('publishes one layer containing both inspectors and the Statistics view', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      publishConfig: { access: string }
      lyn: { bundle: { patch: string } }
      dependencies: Record<string, string>
    }
    expect(manifest.publishConfig.access).toBe('public')
    expect(manifest.lyn.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toEqual({
      '@lyness/lyn-experimental-client-ui-stats': 'workspace:*',
      '@lyness/lyn-experimental-inspector': 'workspace:*',
      '@lyness/lyn-experimental-session-inspector': 'workspace:*',
    })
    expect(parseEntryYaml(readFileSync(new URL(`../${manifest.lyn.bundle.patch}`, import.meta.url), 'utf8'))).toEqual([{ insert: [
      {
        id: 'experimental-inspector', name: '@lyness/lyn-experimental-inspector',
        disabled: false, config: { captureFetch: true },
      },
      { id: 'session-inspector', name: '@lyness/lyn-experimental-session-inspector' },
      { id: 'client-ui-stats', name: '@lyness/lyn-experimental-client-ui-stats' },
    ] }])
  })
})
