/** Shipped profile templates, and the offline catalog that does not depend on installed provider packages or registry requests. */

import { describe, expect, it } from 'vitest'
import { OFFICIAL_ON_DEMAND_CATALOG, ON_DEMAND_BUNDLES, PROFILE_TEMPLATES } from '../src/index.ts'

describe('Official on-demand catalog', () => {
  it('offers exactly the two native subagent integrations with offline localized metadata', () => {
    expect(ON_DEMAND_BUNDLES).toEqual(['@deepseek-ai/dsh-subagent-claude-code', '@deepseek-ai/dsh-subagent-codex'])
    expect(OFFICIAL_ON_DEMAND_CATALOG.map(entry => entry.packageName)).toEqual(ON_DEMAND_BUNDLES)
    for (const entry of OFFICIAL_ON_DEMAND_CATALOG) {
      expect(entry.meta.icon).toMatch(/^data:image\/svg\+xml;base64,/)
      for (const text of [entry.meta.title, entry.meta.description]) {
        if (typeof text === 'string') throw new Error('Official metadata requires both shipped languages')
        expect(text.en).toMatch(/\S/)
        expect(text.zh).toMatch(/\S/)
      }
      expect(entry).not.toHaveProperty('version')
    }
  })
})

describe('Shipped profile templates', () => {
  it('stack each mode bundle on base except the standalone ones', () => {
    expect(PROFILE_TEMPLATES).toEqual({
      acp: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-acp-app'] },
      web: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-web-execution', '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp', '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal', '@deepseek-ai/dsh-module-webhook'] },
      enterprise: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-web-execution', '@deepseek-ai/dsh-module-accounts', '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp', '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-model-governance', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal', '@deepseek-ai/dsh-module-webhook'] },
      hosted: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-accounts', '@deepseek-ai/dsh-module-credits', '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-model-governance', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-webhook'], hosted: true },
      headless: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-headless'] },
      sdk: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-sdk-app'] },
      'sdk-minimal': { bundles: ['@deepseek-ai/dsh-sdk-minimal'] },
      'brand-studio': { bundles: ['@deepseek-ai/dsh-brand-studio'] },
      'brand-setup': { bundles: ['@deepseek-ai/dsh-brand-setup'] },
      'admin-setup': { bundles: ['@deepseek-ai/dsh-admin-setup'] },
    })
  })

  // The absence of the execution plane IS the hosted boundary, so it is
  // asserted here beside the tuple rather than left to the gate alone.
  it('keeps the execution bundle out of every hosted profile', () => {
    for (const [name, template] of Object.entries(PROFILE_TEMPLATES)) {
      if (template.hosted !== true) continue
      expect(template.bundles, name).not.toContain('@deepseek-ai/dsh-module-execution')
    }
  })
})
