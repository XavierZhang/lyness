/** The Host half contributes nothing, which is what lets a browserless Host mount it. */
import { Context } from '@lyness/cordis'
import { FiberState } from '@lyness/cordis'
import { afterEach, expect, it } from 'vitest'
import * as hostPlugin from '../src/index.ts'

const roots: Context[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose())) })

it('mounts with nothing injected and provides no service', async () => {
  const ctx = new Context()
  roots.push(ctx)
  const fiber = await ctx.plugin(hostPlugin).await()
  expect(fiber.state).toBe(FiberState.ACTIVE)
  // The records are the deployment's, served by the controller; this half
  // exists only so the package has a Host entry its client bundle mounts beside.
  expect(ctx.get('signInChannels')).toBeUndefined()
})
