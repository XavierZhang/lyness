/**
 * The book every redirect channel keeps: one callback spent once, a state this
 * process never issued found nothing, and an attempt nobody came back from
 * forgotten rather than accumulated.
 */

import { describe, expect, it } from 'vitest'
import { AttemptBook } from '../src/attempts.ts'

/** A book over a clock the test moves. */
function book(ttlMs = 1000): { subject: AttemptBook<string>; advance: (ms: number) => void } {
  let now = 1_000_000
  return {
    subject: new AttemptBook<string>(ttlMs, () => now),
    advance: (ms) => { now += ms },
  }
}

describe('one attempt in flight', () => {
  it('comes back with what the channel remembered for it', () => {
    const { subject } = book()
    subject.open('state-1', 'verifier-1', 'https://dsh.example/cb')
    expect(subject.take('state-1')).toEqual({ held: 'verifier-1', redirectUri: 'https://dsh.example/cb' })
  })

  it('is spent once, so a replayed callback finds nothing', () => {
    const { subject } = book()
    subject.open('state-1', 'verifier-1', 'https://dsh.example/cb')
    expect(subject.take('state-1')).toBeDefined()
    expect(subject.take('state-1')).toBeUndefined()
  })

  it('is not found under a state this process never issued', () => {
    const { subject } = book()
    subject.open('state-1', 'verifier-1', 'https://dsh.example/cb')
    expect(subject.take('elsewhere')).toBeUndefined()
    // The real attempt is still waiting: a wrong state does not spend it.
    expect(subject.take('state-1')).toBeDefined()
  })

  it('is gone once its lifetime has passed', () => {
    const { subject, advance } = book(1000)
    subject.open('state-1', 'verifier-1', 'https://dsh.example/cb')
    advance(1001)
    expect(subject.take('state-1')).toBeUndefined()
  })

  it('is still waiting at the last moment of its lifetime', () => {
    const { subject, advance } = book(1000)
    subject.open('state-1', 'verifier-1', 'https://dsh.example/cb')
    advance(999)
    expect(subject.take('state-1')).toBeDefined()
  })
})

describe('the book itself', () => {
  it('forgets what nobody came back from when the next sign-in starts', () => {
    const { subject, advance } = book(1000)
    subject.open('abandoned', 'v1', 'https://dsh.example/cb')
    expect(subject.size).toBe(1)
    advance(1001)
    subject.open('fresh', 'v2', 'https://dsh.example/cb')
    // The abandoned one is gone rather than kept beside the new one.
    expect(subject.size).toBe(1)
    expect(subject.take('fresh')).toBeDefined()
  })

  it('keeps every attempt that is still within its lifetime', () => {
    const { subject, advance } = book(1000)
    subject.open('first', 'v1', 'https://dsh.example/cb')
    advance(500)
    subject.open('second', 'v2', 'https://dsh.example/cb')
    expect(subject.size).toBe(2)
  })
})
