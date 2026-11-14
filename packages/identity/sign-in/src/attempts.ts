/**
 * The attempts a redirect channel has in flight.
 *
 * Every redirect channel keeps the same book: a sign-in is recorded under the
 * opaque value the directory will echo, it is taken out before the code is
 * spent so one callback can be used once, and one nobody came back from is
 * forgotten rather than accumulated. The bookkeeping is identical across
 * directories even though the authorization URLs and the token exchanges are
 * not, so it lives here and each channel keeps only what is its own.
 *
 * @module @deepseek-ai/dsh-sign-in/attempts
 */

/** One sign-in waiting for the directory to return the browser. */
export interface HeldAttempt<T> {
  /** Whatever the channel must remember for this attempt, such as its PKCE verifier. */
  readonly held: T
  /** The callback the authorization request named, which redemption must repeat. */
  readonly redirectUri: string
}

/**
 * The attempts one redirect channel has in flight.
 *
 * Keyed by the value the directory echoes, which is also the attempt's id: a
 * directory returns exactly one opaque value, and a second id would have to be
 * carried somewhere it could be separated from this one.
 */
export class AttemptBook<T> {
  private readonly attempts = new Map<string, { readonly held: T; readonly redirectUri: string; readonly expiresAt: number }>()

  /**
   * @param ttlMs - how long an unfinished attempt is remembered.
   * @param now - reads the clock; a test supplies its own.
   */
  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  /**
   * Record one attempt, and forget the ones nobody came back from.
   *
   * Expired attempts are dropped here rather than on a timer: a sign-in is the
   * only moment the book grows, so it is also the only moment it needs
   * sweeping, and an idle deployment runs nothing.
   * @param state - the value the directory will echo back.
   * @param held - what this channel must remember for it.
   * @param redirectUri - the callback this attempt named.
   */
  open(state: string, held: T, redirectUri: string): void {
    const now = this.now()
    for (const [key, attempt] of this.attempts) {
      if (attempt.expiresAt <= now) this.attempts.delete(key)
    }
    this.attempts.set(state, { held, redirectUri, expiresAt: now + this.ttlMs })
  }

  /**
   * Take the attempt one return belongs to, if it is still waiting.
   *
   * Taking rather than reading is the replay guard: the attempt is gone before
   * its code is spent, so a replayed callback link finds nothing. The lookup is
   * also the state check the protocol calls for — an attempt is stored under
   * its own state, so finding one means the echoed value is what this process
   * issued.
   * @param state - the value the directory echoed.
   * @returns what the channel remembered, or undefined when nothing is waiting.
   */
  take(state: string): HeldAttempt<T> | undefined {
    const attempt = this.attempts.get(state)
    this.attempts.delete(state)
    if (attempt === undefined || attempt.expiresAt <= this.now()) return undefined
    return { held: attempt.held, redirectUri: attempt.redirectUri }
  }

  /** How many attempts are waiting, for a deployment watching its own memory. */
  get size(): number {
    return this.attempts.size
  }
}
