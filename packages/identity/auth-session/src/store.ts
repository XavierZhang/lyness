/**
 * Provider: signed-in sessions persisted across restarts.
 *
 * Persisted rather than held in memory so a restart does not sign everybody
 * out. A bearer credential that stops working when the server is redeployed
 * is a bearer credential people learn to distrust.
 *
 * Expiry is enforced on read rather than swept by a timer: a lapsed session
 * must be refused the moment it is presented, and a sweep that has not run
 * yet would let it through.
 *
 * @module @lyness/lyn-auth-session/store
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import { randomUUID } from '@lyness/lyn-util-crypto'
import type { Domain } from '@lyness/lyn-storage-domain'
import type { ActingContext } from '@lyness/lyn-people'
import { AuthSessionStore, SessionUnavailable } from './index.ts'
import type { EstablishRequest } from './index.ts'
import { sessionDomain } from './storage.ts'
import type { AuthSessionId, SignedInSession } from './types.ts'

/** How long a session lasts before a deployment changes it: fourteen days. */
const DEFAULT_LIFETIME_MS = 14 * 24 * 3_600_000

/** Deployment-owned session lifetime. */
export interface Config {
  /** Milliseconds a session lasts; `0` means it does not lapse. Defaults to fourteen days. */
  lifetimeMs?: number
}

export const Config: z<Config> = z.object({
  lifetimeMs: z.number().step(1).min(0).default(DEFAULT_LIFETIME_MS),
})

/**
 * Apply the default for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the lifetime this store applies when a caller names none.
 */
export function resolveLifetime(config: Config): number {
  return config.lifetimeMs ?? DEFAULT_LIFETIME_MS
}

/** Signed-in sessions, persisted and expired on read. */
export class StoredAuthSessions extends AuthSessionStore {
  static inject = ['storageDomain']

  static readonly Config = Config

  private readonly lifetimeMs: number
  private readonly ready: Promise<Domain<typeof sessionDomain>>
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - Host context owning durable storage.
   * @param config - validated session lifetime.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.lifetimeMs = resolveLifetime(config)
    this.ready = ctx.storageDomain.open(sessionDomain)
    ctx.effect(() => async () => {
      await this.chain // Failures reach their own callers; this only waits.
      await (await this.ready).close()
    })
  }

  /**
   * Establish a session, opening on the person's personal context.
   * @param request - who signed in, how, and for how long.
   * @returns the established session.
   */
  async establish(request: EstablishRequest): Promise<SignedInSession> {
    return this.serialise(async (domain) => {
      const id = brandString<AuthSessionId>(randomUUID())
      const lifetime = request.lifetimeMs ?? this.lifetimeMs
      const now = Date.now()
      const record = {
        person: request.person,
        // Personal, never a membership — opening on a standing would be the
        // guess this design exists to avoid, even for a person holding one.
        acting: { person: request.person },
        establishedAt: new Date(now).toISOString(),
        ...lifetime === 0 ? {} : { expiresAt: new Date(now + lifetime).toISOString() },
        method: request.method,
      }
      await domain.table('sessions').put(id, record)
      return { id, ...record }
    })
  }

  /**
   * Read one session, refusing a lapsed one.
   * @param id - the bearer identity presented by a caller.
   * @returns the session.
   * @throws {SessionUnavailable} when unknown or lapsed.
   */
  async read(id: AuthSessionId): Promise<SignedInSession> {
    const domain = await this.ready
    return readLive(domain, id)
  }

  /**
   * Put a checked context in force on one session.
   * @param id - the session to change.
   * @param acting - the context to store, already checked by its own resolver.
   * @returns the session with its new context.
   * @throws {SessionUnavailable} when unknown or lapsed.
   */
  async switchContext(id: AuthSessionId, acting: ActingContext): Promise<SignedInSession> {
    return this.serialise(async (domain) => {
      const current = readLive(domain, id)
      if (acting.person !== current.person) {
        // A context belonging to another person would make every later call
        // from this session act as somebody else.
        throw new SessionUnavailable('session-unknown')
      }
      const record = {
        person: current.person,
        acting,
        establishedAt: current.establishedAt,
        ...current.expiresAt === undefined ? {} : { expiresAt: current.expiresAt },
        method: current.method,
      }
      await domain.table('sessions').put(id, record)
      return { id, ...record }
    })
  }

  /**
   * End one session.
   * @param id - the session to end.
   * @returns true when one was ended.
   */
  async revoke(id: AuthSessionId): Promise<boolean> {
    return this.serialise(async (domain) => {
      const table = domain.table('sessions')
      if (table.get(id) === undefined) return false
      await table.delete(id)
      return true
    })
  }

  /** Run one durable mutation after the previous one settles. */
  private serialise<T>(work: (domain: Domain<typeof sessionDomain>) => Promise<T>): Promise<T> {
    const result = this.ready.then(work)
    this.chain = result.catch(() => undefined)
    return result
  }
}

/**
 * Read one live session, refusing an unknown or lapsed identity.
 *
 * Expiry is checked here rather than swept, because a lapsed session must be
 * refused the moment it is presented.
 * @param domain - the open session domain.
 * @param id - the bearer identity presented.
 * @returns the live session.
 * @throws {SessionUnavailable} when unknown or lapsed.
 */
function readLive(domain: Domain<typeof sessionDomain>, id: AuthSessionId): SignedInSession {
  const record = domain.table('sessions').get(id)
  if (record === undefined) throw new SessionUnavailable('session-unknown')
  if (record.expiresAt !== undefined && Date.parse(record.expiresAt) <= Date.now()) {
    throw new SessionUnavailable('session-expired')
  }
  return { id, ...record }
}

export default StoredAuthSessions
