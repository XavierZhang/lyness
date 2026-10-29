// @vitest-environment jsdom

/**
 * What the section shows: four groups, each row naming who gave it, and one
 * closing line saying none of it is the reader's to change.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ModelCatalog } from '@lyness/lyn-api-session-controller/types'
import { CapabilitiesSection } from '../src/client/CapabilitiesSection.tsx'
import type { CapabilitiesSectionProps } from '../src/client/CapabilitiesSection.tsx'
import type { CapabilitiesSectionState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as CapabilitiesSectionProps['t']

const CATALOG: ModelCatalog = {
  default: { provider: 'deepseek-official', model: 'v4' },
  routableProviders: ['deepseek-official'],
  groups: [{
    id: 'deepseek-official',
    name: 'DeepSeek',
    models: [{ id: 'v4', name: 'V4' }, { id: 'v5', name: 'V5' }],
  }],
  failures: [],
}

/** A ready state over one of each kind. */
function ready(over: Partial<CapabilitiesSectionState> = {}): CapabilitiesSectionState {
  return {
    status: 'ready',
    capabilities: {
      preset: 'coder',
      tools: [{ name: 'bash', description: 'Run a command.', source: 'deployment' }],
      connections: [{ server: 'acme', tools: 2, source: 'preset' }],
      skills: [{ name: 'badge', description: 'Does badge.', origin: 'bundled', provider: 'filesystem' }],
    },
    models: CATALOG,
    ...over,
  }
}

/** One rendered section over a fixed state. */
function renderSection(state: CapabilitiesSectionState) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: CapabilitiesSectionState) => T) => select(state)) as CapabilitiesSectionProps['useStore']
  const view = render(<CapabilitiesSection {...{ t, useStore, load, retry } as CapabilitiesSectionProps} />)
  return { ...view, load, retry }
}

describe('CapabilitiesSection', () => {
  it('asks what is available when the section opens', () => {
    const { load } = renderSection(ready({ status: 'idle' }))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows nothing until the read has answered', () => {
    renderSection(ready({ status: 'loading' }))
    expect(screen.getByText(zh.loading)).toBeDefined()
    expect(screen.queryByText('bash')).toBeNull()
  })

  it('offers a retry when the read broke', () => {
    const { retry } = renderSection(ready({ status: 'failed' }))
    fireEvent.click(screen.getByText(zh.retry))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('names who gave each capability', () => {
    renderSection(ready())
    // The tool came from the deployment, the server from the preset.
    expect(screen.getByText('bash').closest('li')?.textContent).toContain(zh.fromDeployment)
    expect(screen.getByText('acme').closest('li')?.textContent).toContain(zh.fromPreset)
    expect(screen.getByText('badge').closest('li')?.textContent).toContain('bundled · filesystem')
  })

  it('counts a provider models and a server tools', () => {
    renderSection(ready())
    expect(screen.getByText('2 个模型')).toBeDefined()
    expect(screen.getByText('2 个工具')).toBeDefined()
  })

  it('leaves the models out rather than showing none when the catalogue failed', () => {
    renderSection(ready({ models: undefined }))
    expect(screen.getByText(zh.modelsUnavailable)).toBeDefined()
    expect(screen.queryByText(zh.noModels)).toBeNull()
  })

  it('tells a deployment with no skill registry from one that discovered none', () => {
    // No `skills` member at all, which is what a deployment mounting no
    // registry answers.
    renderSection(ready({ capabilities: { preset: 'coder', tools: [], connections: [] } }))
    expect(screen.getByText(zh.skillsAbsent)).toBeDefined()
    cleanup()
    renderSection(ready({ capabilities: { preset: 'coder', tools: [], connections: [], skills: [] } }))
    expect(screen.getByText(zh.noSkills)).toBeDefined()
  })

  it('says so for each group a deployment composed nothing into', () => {
    renderSection(ready({
      capabilities: { tools: [], connections: [], skills: [] },
      models: { ...CATALOG, groups: [] },
    }))
    for (const text of [zh.noTools, zh.noConnections, zh.noSkills, zh.noModels]) {
      expect(screen.getByText(text)).toBeDefined()
    }
  })

  it('closes by naming the preset, and by naming none when there is none', () => {
    renderSection(ready())
    expect(screen.getByText(/coder/u)).toBeDefined()
    cleanup()
    renderSection(ready({ capabilities: { tools: [], connections: [], skills: [] } }))
    expect(screen.getByText(zh.readOnly)).toBeDefined()
  })
})
