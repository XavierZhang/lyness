/** Shipped profile templates, and the offline catalog that does not depend on installed provider packages or registry requests. */

import { describe, expect, it } from 'vitest'
import { OFFICIAL_ON_DEMAND_CATALOG, ON_DEMAND_BUNDLES, PROFILE_TEMPLATES } from '../src/index.ts'

describe('Official on-demand catalog', () => {
  it('offers exactly the two native subagent integrations with offline localized metadata', () => {
    expect(ON_DEMAND_BUNDLES).toEqual(['@lyness/lyn-subagent-claude-code', '@lyness/lyn-subagent-codex'])
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
      acp: { bundles: ['@lyness/lyn-base', '@lyness/lyn-module-execution', '@lyness/lyn-acp-app'] },
      web: { bundles: ['@lyness/lyn-base', '@lyness/lyn-module-execution', '@lyness/lyn-web-app', '@lyness/lyn-web-execution', '@lyness/lyn-module-deliverables', '@lyness/lyn-module-extensions', '@lyness/lyn-module-lsp', '@lyness/lyn-module-memory', '@lyness/lyn-module-schedule', '@lyness/lyn-module-terminal', '@lyness/lyn-module-webhook'] },
      enterprise: { bundles: ['@lyness/lyn-base', '@lyness/lyn-module-execution', '@lyness/lyn-web-app', '@lyness/lyn-web-execution', '@lyness/lyn-module-accounts', '@lyness/lyn-module-deliverables', '@lyness/lyn-module-extensions', '@lyness/lyn-module-lsp', '@lyness/lyn-module-memory', '@lyness/lyn-module-model-governance', '@lyness/lyn-module-schedule', '@lyness/lyn-module-terminal', '@lyness/lyn-module-webhook'] },
      hosted: { bundles: ['@lyness/lyn-base', '@lyness/lyn-web-app', '@lyness/lyn-module-accounts', '@lyness/lyn-module-credits', '@lyness/lyn-module-deliverables', '@lyness/lyn-module-memory', '@lyness/lyn-module-model-governance', '@lyness/lyn-module-schedule', '@lyness/lyn-module-webhook'], hosted: true },
      headless: { bundles: ['@lyness/lyn-base', '@lyness/lyn-module-execution', '@lyness/lyn-headless'] },
      sdk: { bundles: ['@lyness/lyn-base', '@lyness/lyn-module-execution', '@lyness/lyn-sdk-app'] },
      'sdk-minimal': { bundles: ['@lyness/lyn-sdk-minimal'] },
      'brand-studio': { bundles: ['@lyness/lyn-brand-studio'] },
      'brand-setup': { bundles: ['@lyness/lyn-brand-setup'] },
    })
  })

  // The absence of the execution plane IS the hosted boundary, so it is
  // asserted here beside the tuple rather than left to the gate alone.
  it('keeps the execution bundle out of every hosted profile', () => {
    for (const [name, template] of Object.entries(PROFILE_TEMPLATES)) {
      if (template.hosted !== true) continue
      expect(template.bundles, name).not.toContain('@lyness/lyn-module-execution')
    }
  })
})
