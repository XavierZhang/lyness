/**
 * What a stored instant and a stored identity accept, and what they refuse.
 */

import { describe, expect, it } from 'vitest'
import { storedId, storedInstant } from '../src/records.ts'

/** A branded identity standing in for a real one, so the brand is observable. */
type Opaque = string & { readonly __opaque: unique symbol }

describe('storedInstant', () => {
  it('accepts a millisecond-precision UTC instant', () => {
    expect(storedInstant().safeParse('2026-10-15T08:30:00.000Z').success).toBe(true)
  })

  it('refuses a year of 0000, which is what an unset date serialises to', () => {
    expect(storedInstant().safeParse('0000-01-01T00:00:00.000Z').success).toBe(false)
  })

  it('refuses an instant without milliseconds', () => {
    expect(storedInstant().safeParse('2026-10-15T08:30:00Z').success).toBe(false)
  })

  it('refuses a local time, because a record has no timezone to read it in', () => {
    expect(storedInstant().safeParse('2026-10-15T08:30:00.000').success).toBe(false)
  })
})

describe('storedId', () => {
  it('accepts a non-empty identity and keeps its brand', () => {
    const parsed = storedId<Opaque>().safeParse('7a1f')
    // The narrowed value is typed as the brand, which is what a record schema
    // needs: a plain string would not satisfy the field it fills.
    const held: Opaque | false = parsed.success && parsed.data
    expect(held).toBe('7a1f')
  })

  it('refuses an empty identity', () => {
    expect(storedId().safeParse('').success).toBe(false)
  })

  it('refuses a value that is not a string', () => {
    expect(storedId().safeParse(7).success).toBe(false)
  })
})
