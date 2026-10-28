/**
 * The one read both surfaces drive: what it publishes, and how a refused call
 * and a thrown one come out the same.
 */

import { describe, expect, it, vi } from 'vitest'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import { ViewerBinding, rowFace, screenFace } from '../src/client/binding.ts'
import type { ViewerActions } from '../src/client/binding.ts'
import { createViewerReader } from '../src/client/read.ts'
import type { ReadOutcome } from '../src/client/read.ts'

const VIEWER: ViewerView = {
  accounts: true,
  channels: [],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** A sink that records every call made on it, in order. */
function recorder(): ViewerActions & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    begin: () => { calls.push('begin') },
    succeed: (viewer) => { calls.push(`succeed:${String(viewer.accounts)}`) },
    fail: () => { calls.push('fail') },
    reset: () => { calls.push('reset') },
  }
}

/** One scripted reader, and the recorder it publishes into. */
interface Scripted {
  read: ReturnType<typeof createViewerReader>
  sink: ViewerActions & { calls: string[] }
}

/**
 * Build a reader over one scripted read.
 * @param read - what the deployment answers.
 * @returns the reader and the recorder its outcomes land in.
 */
function reader(read: () => Promise<ReadOutcome>): Scripted {
  const sink = recorder()
  return { read: createViewerReader(read, sink), sink }
}

describe('the viewer read', () => {
  it('publishes the viewer it read', async () => {
    const { read, sink } = reader(() => Promise.resolve({ ok: true, value: VIEWER }))
    await read.load()
    expect(sink.calls).toEqual(['begin', 'succeed:true'])
  })

  it('reports a refused call and a thrown one the same way', async () => {
    const refused = reader(() => Promise.resolve({ ok: false }))
    await refused.read.load()
    expect(refused.sink.calls).toEqual(['begin', 'fail'])

    const thrown = reader(() => Promise.reject(new Error('offline')))
    await thrown.read.load()
    expect(thrown.sink.calls).toEqual(['begin', 'fail'])
  })

  it('drops the previous outcome before retrying, so the attempt is what shows', async () => {
    const { read, sink } = reader(() => Promise.resolve({ ok: true, value: VIEWER }))
    await read.retry()
    expect(sink.calls).toEqual(['reset', 'begin', 'succeed:true'])
  })

  it('shares one in-flight read with every caller', async () => {
    const viewer = vi.fn(() => Promise.resolve<ReadOutcome>({ ok: true, value: VIEWER }))
    const { read } = reader(viewer)
    await Promise.all([read.load(), read.load()])
    expect(viewer).toHaveBeenCalledTimes(1)
  })
})

describe('the binding both surfaces share', () => {
  it('publishes to nobody before either has rendered', () => {
    const binding = new ViewerBinding()
    // A read can settle before any store exists; dropping its outcome is what
    // lets the plugin read without waiting for a render.
    expect(() => {
      binding.begin()
      binding.succeed(VIEWER)
      binding.fail()
      binding.reset()
    }).not.toThrow()
  })

  it('publishes one outcome to every bound surface', () => {
    const binding = new ViewerBinding()
    const screen = recorder()
    const row = recorder()
    binding.bind(screen)
    binding.bind(row)
    binding.succeed(VIEWER)
    expect(screen.calls).toEqual(['succeed:true'])
    expect(row.calls).toEqual(['succeed:true'])
  })

  it('stops publishing to a surface that unbound', () => {
    const binding = new ViewerBinding()
    const screen = recorder()
    const row = recorder()
    const release = binding.bind(screen)
    binding.bind(row)
    release()
    binding.begin()
    binding.fail()
    binding.reset()
    expect(screen.calls).toEqual([])
    expect(row.calls).toEqual(['begin', 'fail', 'reset'])
  })
})

describe('the faces the surfaces are registered with', () => {
  it('bind the baked actions and hand each surface what it drives', () => {
    const binding = new ViewerBinding()
    const read = { load: vi.fn(() => Promise.resolve()), retry: vi.fn(() => Promise.resolve()) }
    const screen = recorder()
    const row = recorder()
    const onScreen = screenFace(binding, read)(screen)
    const onRow = rowFace(binding, read)(row)
    expect(onScreen.load).toBe(read.load)
    expect(onScreen.retry).toBe(read.retry)
    expect(onRow.load).toBe(read.load)
    // The row drives no retry: a failure covers the product, and the screen
    // is where somebody tries again.
    expect('retry' in onRow).toBe(false)
    binding.begin()
    expect(screen.calls).toEqual(['begin'])
    expect(row.calls).toEqual(['begin'])
  })
})
