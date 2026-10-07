/**
 * One write at a time.
 *
 * Applying a brand is four writes — three SVGs and the patch layer — against
 * paths every caller shares. Two applies in flight can interleave into a state
 * neither operator asked for: the row naming one brand while the artwork on
 * disk is the other's. Each file replacement is atomic on its own, which is why
 * the hazard is the interleaving rather than a torn file.
 *
 * This orders the runs instead. It does not decide who wins: two operators who
 * apply in turn still leave the later brand, which is what applying twice
 * means.
 */

/** Runs one unit of work after every unit handed over before it. */
export type Serialiser = <T>(work: () => Promise<T>) => Promise<T>

/**
 * Build a serialiser.
 *
 * A failed run does not stop the queue: the next unit starts either way, and
 * each caller sees only its own outcome.
 * @returns the serialiser, which orders every call made on it.
 */
export function createSerialiser(): Serialiser {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work, work)
    tail = result.catch(() => undefined)
    return result
  }
}
