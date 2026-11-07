/**
 * Which benchmark cases decide the lane's exit code, and which are only
 * measured: a blocking failure fails the lane, an observational one is
 * reported and does not.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { runPnpmCommand } from './compile-referenced-projects.ts'
import {
  OBSERVATIONAL_BENCH_FILES, SERIAL_BENCH_FILES, runBenchPhase, runBenchSuite,
} from './run-bench-suite.ts'

vi.mock('./compile-referenced-projects.ts', () => ({ runPnpmCommand: vi.fn() }))

const ROOT = '/repo'

afterEach(() => {
  vi.mocked(runPnpmCommand).mockReset()
  delete process.env.LYNESS_BENCH_REPORT_PHASE
})

/** The positional benchmark files one recorded invocation ran. */
function filesOf(call: readonly [string, readonly string[]] | undefined): readonly string[] {
  return (call?.[1] ?? []).filter(argument => argument.startsWith('benchmarks/'))
}

/** Every invocation the suite made, as `[root, args]` pairs. */
function invocations(): readonly [string, readonly string[]][] {
  return vi.mocked(runPnpmCommand).mock.calls
}

describe('the observational set', () => {
  it('is a subset of the serial cases, so it is never run twice or dropped', () => {
    expect(OBSERVATIONAL_BENCH_FILES.length).toBeGreaterThan(0)
    for (const file of OBSERVATIONAL_BENCH_FILES) {
      expect(SERIAL_BENCH_FILES as readonly string[], file).toContain(file)
    }
  })
})

describe('the phases', () => {
  it('keeps the observational cases out of the blocking serial run and runs them after it', () => {
    runBenchSuite(ROOT)
    const [first, last, observational] = invocations()
    // The first phase excludes every serial case, blocking or not.
    expect(first?.[1]).toContain('--exclude=benchmarks/long-session-browser/long-session.bench.ts')
    const blocking = filesOf(last)
    for (const file of OBSERVATIONAL_BENCH_FILES) expect(blocking, file).not.toContain(file)
    expect(blocking.length).toBe(SERIAL_BENCH_FILES.length - OBSERVATIONAL_BENCH_FILES.length)
    expect(filesOf(observational)).toEqual([...OBSERVATIONAL_BENCH_FILES])
  })

  it('continues the report rather than clearing it, so appended samples survive', () => {
    const phases: (string | undefined)[] = []
    vi.mocked(runPnpmCommand).mockImplementation(() => { phases.push(process.env.LYNESS_BENCH_REPORT_PHASE) })
    runBenchSuite(ROOT)
    // Only the first invocation clears; the rendering phase and the appended
    // observational run both continue that same report.
    expect(phases).toEqual(['first', 'last', 'last'])
    expect(process.env.LYNESS_BENCH_REPORT_PHASE).toBeUndefined()
  })

  it('releases the report phase even when its invocation throws', () => {
    vi.mocked(runPnpmCommand).mockImplementation(() => { throw new Error('vitest failed') })
    expect(() => { runBenchPhase(ROOT, 'first') }).toThrow('vitest failed')
    expect(process.env.LYNESS_BENCH_REPORT_PHASE).toBeUndefined()
  })
})

describe('the exit code', () => {
  it('is zero when every blocking phase passed', () => {
    expect(runBenchSuite(ROOT)).toBe(0)
  })

  it('stays zero when only an observational case failed, and says so', () => {
    const reported: string[] = []
    vi.spyOn(console, 'error').mockImplementation((message: unknown) => { reported.push(String(message)) })
    vi.mocked(runPnpmCommand).mockImplementation((_root, args) => {
      const files = args.filter(argument => argument.startsWith('benchmarks/'))
      if (files.some(file => (OBSERVATIONAL_BENCH_FILES as readonly string[]).includes(file))) {
        throw new Error('the browser case missed its budget')
      }
    })
    expect(runBenchSuite(ROOT)).toBe(0)
    expect(reported.join('\n')).toContain('the browser case missed its budget')
    expect(reported.join('\n')).toContain('does not fail the lane')
  })

  it('is one when a blocking phase failed, and every later phase still runs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(runPnpmCommand).mockImplementationOnce(() => { throw new Error('the CPU cases missed their budget') })
    expect(runBenchSuite(ROOT)).toBe(1)
    expect(invocations()).toHaveLength(3)
  })
})
