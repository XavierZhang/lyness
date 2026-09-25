/** Real Web startup, mounted plugin package identities, and delivered Client graph isolation. */

import { FiberState } from '@lyness/cordis'
import type { WebBootGraph } from '@lyness/lyn-client-modules/client'
import { expect, it } from 'vitest'
import { experimentalRuntimeReferences, modulePackage } from './runtime-roster.ts'
import { withDefaultWeb, webGet } from './default-web-process.ts'

const experimentalName = '@lyness/lyn-experimental-client-ui-agent-team'

it('boots default Web without experimental modules, scheduling, time context, or an active built-in Browser', async (test) => {
  await withDefaultWeb(test, async ({ url, request }) => {
    const auth = await webGet(url, test.signal)
    const cookie = auth.headers['set-cookie']?.[0]?.split(';', 1)[0]
    expect(cookie).toBeDefined()
    const page = await webGet(new URL('/', url), test.signal, { cookie: cookie! })
    expect(page.status).toBe(200)
    const html = page.text
    const rawBoot = /globalThis\["__LYNESS_BOOT__"\] = ([\s\S]*?)<\/script>/u.exec(html)?.[1]
    expect(rawBoot, html).toBeDefined()
    const delivered = JSON.parse(rawBoot!) as WebBootGraph
    const roster = await request('roster')
    expect(roster.client).toEqual(delivered)
    expect(roster.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '@lyness/lyn-host-webserver', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@lyness/lyn-client-modules', state: FiberState.ACTIVE }),
    ]))
    expect(roster.entries.some(entry => entry.name.endsWith('/runtime-roster-observer.js') && entry.state === FiberState.ACTIVE)).toBe(true)
    expect(roster.plugins.length).toBeGreaterThan(roster.entries.length)
    expect(roster.modules.some(url => modulePackage(url) === '@lyness/lyn')).toBe(true)
    expect(roster.client.entries.length).toBeGreaterThan(0)
    for (const name of [
      '@lyness/lyn-client-ui-sidebar-browser',
      '@lyness/lyn-time-context',
      '@lyness/lyn-schedule',
      '@lyness/lyn-client-ui-schedule',
    ]) {
      const entry = roster.entries.find(entry => entry.name === name)
      expect(entry, name).toBeDefined()
      expect(entry!.state, name).toBeUndefined()
      expect(delivered.entries.some(entry => entry.id === name), name).toBe(false)
    }
    expect(experimentalRuntimeReferences(roster)).toEqual([])

    const contaminated = await request('mount-experimental')
    expect(contaminated.entries.some(entry => entry.name === experimentalName)).toBe(false)
    const mounted = contaminated.plugins.filter(plugin => plugin.modules.some(url => modulePackage(url) === experimentalName))
    expect(mounted).toEqual([expect.objectContaining({ state: FiberState.ACTIVE })])
    expect(experimentalRuntimeReferences(contaminated)).toEqual(expect.arrayContaining([
      expect.stringContaining('/packages/experimental/client-ui-agent-team/'),
    ]))
  })
})
