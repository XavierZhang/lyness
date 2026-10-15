/**
 * Publishing the principal of a call, and the deliberate choice to resolve
 * rather than refuse.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'
import StoredAuthSessions from '@lyness/lyn-auth-session/store'
import { afterEach, expect, it } from 'vitest'
import RequestPrincipal, { IDENTITY_COOKIE } from '../src/index.ts'
import type { Principal } from '../src/index.ts'

const ADA = brandString<PersonId>('ada')
const ADA_STANDING = brandString<MembershipId>('ada:member')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

/** A context with sessions, a connection double, and the principal plugin. */
async function harness(): Promise<{ ctx: Context; runWith: (request: Request) => Promise<Principal | undefined> }> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-principal-'))
  roots.push(root)
  const scopes: Scope[] = []
  const ctx = new Context()
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
    runWith: async (request: Request) => {
      let seen: Principal | undefined
      // The scope is the only way a principal is published, so the test must
      // go through it rather than calling current() outside a call.
      for (const scope of scopes) {
        await scope(request, () => {
          seen = ctx.requestPrincipal.current()
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
