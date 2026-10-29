/**
 * What the calls do: one in-flight read shared across both namespaces, and a
 * model catalogue allowed to fail on its own without taking the page down.
 */

import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type { AgentCapabilitiesView } from '@lyness/lyn-api-agent-capabilities-controller/types'
import type { ModelCatalog } from '@lyness/lyn-api-session-controller/types'
import { createCapabilitiesOperations } from '../src/client/operations.ts'
import type { CapabilitiesCalls, CapabilitiesSink } from '../src/client/operations.ts'

const VIEW: AgentCapabilitiesView = { tools: [], connections: [] }
const CATALOG: ModelCatalog = {
  default: { provider: 'deepseek-official', model: 'v4' },
  routableProviders: [],
  groups: [],
  failures: [],
}
const REFUSED: RemoteFailure = new RemoteError('gateway/internal', 'no providers', {})

/** A sink that records what it was told, in order. */
function recorder() {
  const seen: string[] = []
  const sink: CapabilitiesSink = {
    begin: () => { seen.push('begin') },
    succeed: (read) => { seen.push(`succeed:${read.models === undefined ? 'no-models' : 'models'}`) },
    fail: () => { seen.push('fail') },
    reset: () => { seen.push('reset') },
  }
  return { seen, sink }
}

describe('the capabilities operations', () => {
  it('shares one read between callers that ask at once', async () => {
    const capabilities = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { seen, sink } = recorder()
    const operations = createCapabilitiesOperations(
      { capabilities, models: () => Promise.resolve({ ok: true, value: CATALOG }) }, sink)
    await Promise.all([operations.load(), operations.load()])
    expect(capabilities).toHaveBeenCalledOnce()
    expect(seen).toEqual(['begin', 'succeed:models'])
  })

  it('keeps the page when only the model catalogue refused', async () => {
    const { seen, sink } = recorder()
    const operations = createCapabilitiesOperations({
      capabilities: () => Promise.resolve({ ok: true as const, value: VIEW }),
      models: () => Promise.resolve({ ok: false as const, error: REFUSED }),
    }, sink)
    await operations.load()
    // A deployment whose provider list is broken still has tools and skills
    // worth reading.
    expect(seen).toEqual(['begin', 'succeed:no-models'])
  })

  it('reports no answer when the capability read refused', async () => {
    const { seen, sink } = recorder()
    const operations = createCapabilitiesOperations({
      capabilities: () => Promise.resolve({ ok: false as const, error: REFUSED }),
      models: () => Promise.resolve({ ok: true as const, value: CATALOG }),
    }, sink)
    await operations.load()
    expect(seen).toEqual(['begin', 'fail'])
  })

  it('reports a read that threw the same way as one that refused', async () => {
    const { seen, sink } = recorder()
    const operations = createCapabilitiesOperations({
      capabilities: () => Promise.reject(new Error('the carrier went away')),
      models: () => Promise.resolve({ ok: true as const, value: CATALOG }),
    }, sink)
    await operations.load()
    expect(seen).toEqual(['begin', 'fail'])
  })

  it('shows the attempt rather than the failure it replaces', async () => {
    let answer: () => Promise<{ ok: boolean; value?: AgentCapabilitiesView; error?: RemoteFailure }> =
      () => Promise.resolve({ ok: false, error: REFUSED })
    const { seen, sink } = recorder()
    const operations = createCapabilitiesOperations({
      capabilities: () => answer(),
      models: () => Promise.resolve({ ok: true as const, value: CATALOG }),
    } as CapabilitiesCalls, sink)
    await operations.load()
    answer = () => Promise.resolve({ ok: true, value: VIEW })
    await operations.retry()
    expect(seen).toEqual(['begin', 'fail', 'reset', 'begin', 'succeed:models'])
  })
})
