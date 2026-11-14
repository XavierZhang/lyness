// @vitest-environment jsdom

/**
 * What the invitation page's wiring decides: whether it takes the page at
 * all, what it reads out of the link, and what it tells the page about the
 * visit — including that it asks the deployment nothing about the code.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { TestRemote } from '@lyness/lyn-client-test-runtime'
import {
  apply, channelRows, codeOf, Config, DEFAULT_PATH, inject, joinPage, NS, ROOT_PRIORITY,
} from '@lyness/lyn-client-ui-join/client'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import { JoinPage } from '../src/client/JoinPage.tsx'
import type { JoinPageInjected } from '../src/client/JoinPage.tsx'

const live: Context[] = []

/** The viewer snapshot the service publishes, as a double supplies it. */
interface ViewerSnapshotDouble {
  status: string
  viewer: ViewerView | undefined
  administers: boolean
}

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  window.history.replaceState({}, '', '/')
})

/** Mount the page over a slot registry, a locale and the namespace, at one URL. */
async function bench(url: string, config: Config = {}, viewer?: unknown, accept?: () => Promise<unknown>) {
  window.history.replaceState({}, '', url)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  if (viewer !== undefined) ctx.provide('uiViewer', viewer as never)
  const events = new TestRemote(ctx, {
    invitations: { accept: accept ?? (() => Promise.resolve({ ok: true, value: { accepted: false } })) },
  })
  events.$host = { home: undefined, isLoopback: true }
  const fiber = ctx.plugin({ inject: [...inject], apply, Config }, config)
  await fiber.await()
  return { ctx, locale, fiber }
}

/** The root entry this page registered, if it registered one. */
function rootEntry(ctx: Context) {
  return ctx.slots.entries('root').find(entry => entry.component === JoinPage)
}

/** The injected face this page hands its component. */
function visitOf(ctx: Context): JoinPageInjected['hooks']['visit'] {
  const factory = rootEntry(ctx)?.inject
  if (factory === undefined) throw new Error('the invitation page registered no injected face')
  const hooks = factory()['hooks'] as JoinPageInjected['hooks']
  return hooks.visit
}

/** The accept the page registered, as the framework would call it. */
function acceptOf(ctx: Context): JoinPageInjected['accept'] {
  const factory = rootEntry(ctx)?.inject
  if (factory === undefined) throw new Error('the invitation page registered no injected face')
  return factory()['accept'] as JoinPageInjected['accept']
}

/** One viewer service double over a fixed snapshot. */
function viewerService(snapshot: ViewerSnapshotDouble, load = vi.fn(async () => {})) {
  return {
    load,
    state: { getSnapshot: () => snapshot, subscribe: () => () => {} },
  }
}

/** One deployment with accounts and these channels, nobody signed in. */
function signedOut(channels: ViewerView['channels']): ViewerSnapshotDouble {
  return {
    status: 'ready',
    viewer: {
      accounts: true, channels, standings: [],
      signInPrefix: '/auth/sign-in', signOutPath: '/auth/sign-out',
    },
    administers: false,
  }
}

describe('whether this page takes the document', () => {
  it('reads the path the document was served at', () => {
    expect(joinPage('/join', '/join')).toBe(true)
    // The Host redirects the trailing slash, but a client that sees it anyway
    // is on this page.
    expect(joinPage('/join', '/join/')).toBe(true)
    expect(joinPage('/join/', '/join')).toBe(true)
    for (const pathname of ['/', '/joinx', '/join/code', '/admin']) {
      expect(joinPage('/join', pathname), pathname).toBe(false)
    }
  })

  it('registers nothing on the workbench page', async () => {
    const { ctx, locale } = await bench('/?invite=the-code')
    expect(ctx.slots.entries('root')).toEqual([])
    // Not even its dictionary: a page it does not own is a page it leaves alone.
    expect(locale.bind(NS)('title')).toBe('title')
  })

  it('takes the page at its configured path, under the workbench frame\'s priority', async () => {
    const { ctx } = await bench('/welcome?invite=the-code', { path: '/welcome' })
    // `root` is a single slot and the lowest priority renders, so this is
    // what puts the page here instead of the workbench.
    expect(rootEntry(ctx)?.options).toMatchObject({ priority: ROOT_PRIORITY })
  })

  it('defaults to /join, with or without a schema to default it', async () => {
    const validated = await bench(`${DEFAULT_PATH}?invite=the-code`)
    expect(rootEntry(validated.ctx)).toBeDefined()
    expect(Config({}).path).toBe(DEFAULT_PATH)

    window.history.replaceState({}, '', DEFAULT_PATH)
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    const events = new TestRemote(ctx, { invitations: { accept: () => Promise.resolve({ ok: true, value: { accepted: false } }) } })
    events.$host = { home: undefined, isLoopback: true }
    // A composition that states no path, reaching apply() without the
    // schema's default: the page still knows where it lives.
    await ctx.plugin({ inject: [...inject], apply }, {}).await()
    expect(rootEntry(ctx)).toBeDefined()
  })

  it('gives the page back when it unloads', async () => {
    const { ctx, fiber } = await bench('/join?invite=the-code')
    expect(rootEntry(ctx)).toBeDefined()
    await fiber.dispose()
    expect(ctx.slots.entries('root')).toEqual([])
  })
})

describe('the code the link carries', () => {
  it('is whatever the query parameter holds, and nothing when it holds nothing', () => {
    expect(codeOf('?invite=the-code')).toBe('the-code')
    expect(codeOf('?invite=a%20b')).toBe('a b')
    expect(codeOf('?invite=')).toBeUndefined()
    expect(codeOf('?other=x')).toBeUndefined()
    expect(codeOf('')).toBeUndefined()
  })
})

describe('what this page tells its component', () => {
  it('reports an uninvited visit without reading the viewer at all', async () => {
    const load = vi.fn(async () => {})
    const { ctx } = await bench('/join', {}, viewerService(signedOut([]), load))
    const visit = visitOf(ctx)
    expect(visit.getSnapshot()).toEqual({ invited: false, accounts: false, signedIn: false, channels: [] })
    // Nothing to redeem, so nothing to ask: the page costs the deployment no
    // request at all.
    const off = visit.subscribe(() => {})
    expect(load).not.toHaveBeenCalled()
    off()
  })

  it('reports no accounts where the deployment keeps none', async () => {
    const { ctx } = await bench('/join?invite=the-code')
    const visit = visitOf(ctx)
    // No viewer service: the person at the keyboard is the operator, so there
    // is nobody an invitation could admit.
    expect(visit.getSnapshot()).toEqual({ invited: true, accounts: false, signedIn: false, channels: [] })
    const stop = visit.subscribe(() => {})
    expect(stop).toBeInstanceOf(Function)
    stop()
  })

  it('offers the directories a browser can begin, each carrying the code', async () => {
    const { ctx } = await bench('/join?invite=a%20b', {}, viewerService(signedOut([
      { id: 'oidc', displayName: 'Single sign-on', redirect: true },
      { id: 'desktop', displayName: 'This device', redirect: false },
    ])))
    const visit = visitOf(ctx)
    expect(visit.getSnapshot()).toEqual({
      invited: true,
      accounts: true,
      signedIn: false,
      // A self-driven channel completes in the process that owns the browser,
      // so a page cannot begin it and does not offer it.
      channels: [{ href: '/auth/sign-in/oidc?invite=a%20b', displayName: 'Single sign-on' }],
    })
    const stable = visit.getSnapshot()
    expect(visit.getSnapshot()).toBe(stable)
  })

  it('starts the viewer read on subscription, once', async () => {
    const load = vi.fn(async () => {})
    const { ctx } = await bench('/join?invite=the-code', {}, viewerService(signedOut([]), load))
    const off = visitOf(ctx).subscribe(() => {})
    expect(load).toHaveBeenCalledOnce()
    off()
  })

  it('reports somebody already signed in, and offers them no directory', async () => {
    const { ctx } = await bench('/join?invite=the-code', {}, viewerService({
      status: 'ready',
      viewer: {
        accounts: true,
        person: { id: 'p1', displayName: '张工' },
        standing: { id: 's1', role: 'member' },
        channels: [{ id: 'oidc', displayName: 'Single sign-on', redirect: true }],
        signInPrefix: '/auth/sign-in',
        standings: [],
        signOutPath: '/auth/sign-out',
      },
      administers: false,
    }))
    expect(visitOf(ctx).getSnapshot()).toEqual({
      invited: true, accounts: true, signedIn: true, channels: [],
    })
  })

  it('offers nothing while the viewer read is still out', async () => {
    const { ctx } = await bench('/join?invite=the-code', {}, viewerService({
      status: 'idle', viewer: undefined, administers: false,
    }))
    // A page drawn from a guess would offer links that may turn out wrong.
    expect(visitOf(ctx).getSnapshot()).toEqual({
      invited: true, accounts: false, signedIn: false, channels: [],
    })
  })

  it('builds one row per redirect channel, from the viewer answer alone', () => {
    const rows = channelRows({
      accounts: true,
      channels: [
        { id: 'oidc', displayName: 'Single sign-on', redirect: true },
        { id: 'wecom', displayName: 'Head office', redirect: true },
      ],
      signInPrefix: '/auth/sign-in',
      standings: [],
      signOutPath: '/auth/sign-out',
    }, 'the-code')
    expect(rows).toEqual([
      { href: '/auth/sign-in/oidc?invite=the-code', displayName: 'Single sign-on' },
      { href: '/auth/sign-in/wecom?invite=the-code', displayName: 'Head office' },
    ])

    // Nothing a browser can begin: one shared empty answer, so a page that
    // reads it twice is handed the same array.
    const none = channelRows({
      accounts: true,
      channels: [{ id: 'desktop', displayName: 'This device', redirect: false }],
      signInPrefix: '/auth/sign-in',
      standings: [],
      signOutPath: '/auth/sign-out',
    }, 'the-code')
    expect(none).toEqual([])
    expect(channelRows({
      accounts: true, channels: [], signInPrefix: '/auth/sign-in', signOutPath: '/auth/sign-out',
      standings: [],
    }, 'the-code')).toBe(none)
  })
})

describe('what the page accepts with', () => {
  it('hands the page an accept that reaches the deployment with this visit\'s code', async () => {
    const accept = vi.fn(() => Promise.resolve({ ok: true, value: { accepted: true, role: 'member', organization: 'acme' } }))
    const { ctx } = await bench(`${DEFAULT_PATH}?invite=the-code`, {}, undefined, accept)
    await acceptOf(ctx)()
    // The code comes from the link this page was opened with; nothing else
    // names it, so a page opened without one asks nothing.
    expect(accept).toHaveBeenCalledWith('the-code')
  })
})
