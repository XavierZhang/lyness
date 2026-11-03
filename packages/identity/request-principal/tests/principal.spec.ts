/**
 * Publishing the principal of a call, and the deliberate choice to resolve
 * rather than refuse.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import { afterEach, expect, it } from 'vitest'
import RequestPrincipal, { IDENTITY_COOKIE } from '../src/index.ts'
import type { Principal } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const ADA_STANDING = brandString<MembershipId>('ada:member')
const roots: string[] = []
const live: Context[] = []
afterEach(async () => {
  // The session store keeps its domain open on the temp root, so the context
  // settles before the directory under it is removed.
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

/** A context with sessions, a connection double, and the principal plugin. */
interface Harness {
  readonly ctx: Context
  /** Run one request through the registered scope, optionally doing more inside it. */
  readonly runWith: (request: Request, inside?: () => void) => Promise<Principal | undefined>
}

async function harness(): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), 'dsh-principal-'))
  roots.push(root)
  const scopes: Scope[] = []
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredAuthSessions, {}).await()
  ctx.provide('connection', {
    rpc: {
      scope: (scope: Scope) => {
        scopes.push(scope)
        return () => Promise.resolve()
      },
    },
  })
  await ctx.plugin(RequestPrincipal).await()
  return {
    ctx,
    runWith: async (request: Request, inside?: () => void) => {
      let seen: Principal | undefined
      // The scope is the only way a principal is published, so the test must
      // go through it rather than calling current() outside a call.
      for (const scope of scopes) {
        await scope(request, () => {
          seen = ctx.requestPrincipal.current()
          inside?.()
          return Promise.resolve(undefined)
        })
      }
      return seen
    },
  }
}

/** A request presenting the given identity in a cookie. */
function presenting(id: string): Request {
  return new Request('http://127.0.0.1/api/x', { headers: { cookie: `${IDENTITY_COOKIE}=${id}` } })
}

it('publishes the person and the context their session has in force', async () => {
  const { ctx, runWith } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })
  await ctx.authSessions.switchContext(session.id, { person: ADA, membership: ADA_STANDING })

  expect(await runWith(presenting(session.id)))
    .toEqual({ person: ADA, acting: { person: ADA, membership: ADA_STANDING } })
})

it('publishes nothing for a call presenting no identity', async () => {
  const { runWith } = await harness()

  expect(await runWith(new Request('http://127.0.0.1/api/x'))).toBeUndefined()
})

it('proceeds with no principal for an unknown identity rather than refusing', async () => {
  const { runWith } = await harness()

  // The scope runs after authentication and envelope decoding have accepted
  // the call, so it is not a place to reject one; the operation that needs a
  // principal is where the refusal belongs and where the reason can be given.
  expect(await runWith(presenting('never-issued'))).toBeUndefined()
})

it('proceeds with no principal for a lapsed session', async () => {
  const { ctx, runWith } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso', lifetimeMs: 1 })
  await new Promise(resolve => setTimeout(resolve, 5))

  // Unknown and lapsed are the same answer here: this call speaks for nobody.
  expect(await runWith(presenting(session.id))).toBeUndefined()
})

it('publishes nothing outside a call', async () => {
  const { ctx } = await harness()

  expect(ctx.requestPrincipal.current()).toBeUndefined()
})

it('re-enters a captured principal for work that outlives its call', async () => {
  const { ctx, runWith } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })
  const ada = await runWith(presenting(session.id))

  // A stream's later frames are pulled by the transport, with no call of
  // their own: re-entry is what keeps them answering for whoever opened it.
  expect(ctx.requestPrincipal.as(ada, () => ctx.requestPrincipal.current())).toEqual(ada)
})

it('re-enters an absent principal as absent rather than inheriting the caller', async () => {
  const { ctx, runWith } = await harness()
  const session = await ctx.authSessions.establish({ person: ADA, method: 'sso' })

  // Re-entered from inside a call that does speak for somebody: a generation
  // nobody opened must not be answered as whichever call pulls its frames.
  let reentered: Principal | undefined
  let ran = false
  await runWith(presenting(session.id), () => {
    reentered = ctx.requestPrincipal.as(undefined, () => ctx.requestPrincipal.current())
    ran = true
  })
  expect(ran).toBe(true)
  expect(reentered).toBeUndefined()
})
