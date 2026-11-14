/**
 * The two field schemas every stored record is built from.
 *
 * They live with the domain rather than in each package because a record's
 * acceptance has to be the same wherever it is read: a timestamp one domain
 * accepts and another rejects would make the same JSON valid in one table and
 * malformed in the next.
 *
 * @module @lyness/lyn-storage-domain/records
 */

import { z } from 'zod'

/**
 * A UTC calendar instant as a record stores it.
 *
 * Millisecond precision, and a four-digit year that is not `0000`: that year
 * is what an unset or zeroed date serialises to, so accepting it would let a
 * missing timestamp pass as a real one.
 * @returns the schema a stored instant field uses.
 */
export function storedInstant(): z.ZodType<string> {
  return z.iso.datetime({ precision: 3 }).refine(value => !value.startsWith('0000-'), {
    message: 'Expected a canonical four-digit-year UTC calendar instant',
  })
}

/**
 * A branded opaque identity as a record stores it.
 *
 * `z.custom` rather than `z.string()` because the brand is what the record
 * type requires, and casting through `unknown` to pretend one is the other is
 * forbidden here.
 * @returns the schema a stored identity field uses, carrying the brand.
 */
export function storedId<T extends string>(): z.ZodType<T> {
  return z.custom<T>(value => typeof value === 'string' && value.length > 0, {
    message: 'Expected a non-empty opaque identity',
  })
}
