/**
 * The Host half contributes nothing: the console is a browser surface over
 * namespaces other packages own, and this entry exists so the client bundle
 * has a Host row to mount beside.
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { apply } from '@deepseek-ai/dsh-client-ui-admin-console'

const live: Context[] = []

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
})

describe('the console Host half', () => {
  it('mounts and provides nothing', async () => {
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin({ apply }).await()
    expect(ctx.get('uiAdminConsole')).toBeUndefined()
  })
})
