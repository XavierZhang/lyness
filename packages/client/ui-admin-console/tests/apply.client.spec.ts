// @vitest-environment jsdom

/**
 * What the console's wiring decides: whether it takes the page at all, which
 * seats it declares when it does, and what it tells the frame about the pages
 * and the viewer.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { LocaleRuntime } from '@lyness/lyn-client-locale/client'
import { apply, Config, consolePage, createAdminConsoleStore, DEFAULT_PATH, inject, NS } from '@lyness/lyn-client-ui-admin-console/client'
import { AdminFrame } from '../src/client/AdminFrame.tsx'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import type { AdminFrameInjected } from '../src/client/AdminFrame.tsx'

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
  // The console's selection persists per browser; one case's pick is not the next one's.
  localStorage.clear()
})

/** Mount the console over a slot registry and a locale, at one pathname. */
async function bench(pathname: string, config: Config = {}, viewer?: unknown) {
  window.history.replaceState({}, '', pathname)
  const ctx = new Context()
  live.push(ctx)
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  // Before the console mounts: it reads the service once, when it takes the page.
  if (viewer !== undefined) ctx.provide('uiViewer', viewer as never)
  const fiber = ctx.plugin({ inject: [...inject], apply, Config }, config)
  await fiber.await()
  return { ctx, locale, fiber }
}

/** The root entry the console registered, if it registered one. */
function rootEntry(ctx: Context) {
  return ctx.slots.entries('root').find(entry => entry.component === AdminFrame)
}

/** The injected face the console hands its frame. */
function injectedOf(ctx: Context): AdminFrameInjected {
  const inject = rootEntry(ctx)?.inject
  if (inject === undefined) throw new Error('the console registered no injected face')
  const face = inject()
  const hooks = face['hooks'] as AdminFrameInjected['hooks']
  const act = face['act'] as AdminFrameInjected['act']
  return { hooks, act }
}

describe('whether the console takes the page', () => {
  it('reads the path the document was served at', () => {
    expect(consolePage('/admin', '/admin')).toBe(true)
    // The Host redirects the trailing slash, but a client that sees it anyway
    // is on the console's page.
    expect(consolePage('/admin', '/admin/')).toBe(true)
    expect(consolePage('/admin/', '/admin')).toBe(true)
    for (const pathname of ['/', '/adminx', '/admin/people', '/workbench']) {
      expect(consolePage('/admin', pathname), pathname).toBe(false)
    }
  })

  it('registers nothing on the workbench page', async () => {
    const { ctx, locale } = await bench('/')
    expect(ctx.slots.entries('root')).toEqual([])
    // Not even its dictionary: a page it does not own is a page it leaves alone.
    expect(locale.bind(NS)('console')).toBe('console')
  })

  it('takes the page at its configured path and declares the pages seat', async () => {
    const { ctx } = await bench('/console', { path: '/console' })
    expect(rootEntry(ctx)).toBeDefined()
    expect(ctx.slots.spec('admin.section')).toEqual({ kind: 'list', scope: 'root' })
    // Not the workbench frame's overlay: that seat is declared by the frame
    // this console shadows, and declaring it twice fails the other's boot.
    expect(ctx.slots.spec('shell.overlay')).toBeUndefined()
  })

  it('defaults to /admin', async () => {
    const { ctx } = await bench(DEFAULT_PATH)
    expect(rootEntry(ctx)).toBeDefined()
    expect(Config({}).path).toBe(DEFAULT_PATH)
  })

  it('takes the default path even when nothing validated its config', async () => {
    // A composition that states no path, reaching apply() without the schema's
    // default: the console still knows where it lives.
    window.history.replaceState({}, '', DEFAULT_PATH)
    const ctx = new Context()
    live.push(ctx)
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    ctx.provide('locale', locale)
    await ctx.plugin({ inject: [...inject], apply }, {}).await()
    expect(rootEntry(ctx)).toBeDefined()
  })

  it('keeps the selected page across a reload of the console', () => {
    const instance = createAdminConsoleStore().create()
    expect(instance.store.getSnapshot()).toEqual({ activeId: undefined })
    instance.actions.select('people')
    expect(instance.store.getSnapshot()).toEqual({ activeId: 'people' })
  })

  it('seats one store for the page, not one per render', async () => {
    const { ctx } = await bench('/admin')
    const handle = rootEntry(ctx)?.store
    if (handle === undefined || typeof handle === 'function') throw new Error('the console seated no store handle')
    // The frame re-renders; the selection must not reset under it.
    expect(handle.create()).toBe(handle.create())
  })

  it('gives the page back when it unloads', async () => {
    const { ctx, fiber } = await bench('/admin')
    expect(rootEntry(ctx)).toBeDefined()
    await fiber.dispose()
    expect(ctx.slots.entries('root')).toEqual([])
  })
})

describe('what the console tells its frame', () => {
  it('projects the administration pages in declared order, with their own names', async () => {
    const { ctx, locale } = await bench('/admin')
    const { sections } = injectedOf(ctx).hooks
    expect(sections.getSnapshot()).toEqual([])
    ctx.slots.register({ name: 'admin.section', id: 'people', order: 35, label: () => '人员' } as never, () => null)
    ctx.slots.register({ name: 'admin.section', id: 'models', order: 10, label: 'Models' } as never, () => null)
    expect(sections.getSnapshot()).toEqual([
      { id: 'models', order: 10, label: 'Models' },
      { id: 'people', order: 35, label: '人员' },
    ])
    // A page that declares neither order nor a usable label still appears:
    // the projection's defaults are what keep it reachable.
    ctx.slots.register({ name: 'admin.section', id: 'bare' } as never, () => null)
    ctx.slots.register({ name: 'admin.section', id: 'odd', order: 60, label: 7 } as never, () => null)
    ctx.slots.register({ name: 'admin.section', id: 'odder', order: 70, label: () => 7 } as never, () => null)
    expect(sections.getSnapshot().find(row => row.id === 'bare')).toEqual({ id: 'bare', order: 0, label: '' })
    expect(sections.getSnapshot().find(row => row.id === 'odd')).toEqual({ id: 'odd', order: 60, label: '' })
    expect(sections.getSnapshot().find(row => row.id === 'odder')).toEqual({ id: 'odder', order: 70, label: '' })
    // Stable until the ledger or the locale moves (the uSES contract).
    const rows = sections.getSnapshot()
    expect(sections.getSnapshot()).toBe(rows)
    const listener = vi.fn()
    const off = sections.subscribe(listener)
    locale.setLocale('en')
    expect(sections.getSnapshot()).not.toBe(rows)
    off()
  })

  it('names nobody and offers no sign-out where a deployment has no accounts', async () => {
    const { ctx } = await bench('/admin')
    const { viewer } = injectedOf(ctx).hooks
    // No viewer service: the person at the keyboard is the operator, so the
    // console is theirs.
    expect(viewer.getSnapshot()).toEqual({
      name: undefined, signOutPath: undefined, administers: true, accounts: false, signedIn: false, channels: [],
      standings: [], standing: undefined,
    })
    const stop = viewer.subscribe(() => {})
    expect(stop).toBeInstanceOf(Function)
    stop()
  })

  it('reads who is viewing from the viewer service, and starts its read on subscription', async () => {
    const load = vi.fn(async () => {})
    const listeners = new Set<() => void>()
    let snapshot: ViewerSnapshotDouble = { status: 'idle', viewer: undefined, administers: false }
    const { ctx } = await bench('/admin', {}, {
      load,
      state: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
      },
    })
    const { viewer } = injectedOf(ctx).hooks
    expect(viewer.getSnapshot()).toEqual({
      name: undefined, signOutPath: undefined, administers: false, accounts: false, signedIn: false, channels: [],
      standings: [], standing: undefined,
    })
    const off = viewer.subscribe(() => {})
    expect(load).toHaveBeenCalledOnce()
    snapshot = {
      status: 'ready',
      viewer: {
        accounts: true,
        person: { id: 'p1', displayName: '张工' },
        standing: { id: 's1', role: 'platform-administrator' },
        standings: [{ id: 's1', role: 'platform-administrator' }],
        channels: [],
        signInPrefix: '/auth/sign-in',
        signOutPath: '/auth/sign-out',
      },
      administers: true,
    }
    expect(viewer.getSnapshot()).toEqual({
      name: '张工', signOutPath: '/auth/sign-out', administers: true, accounts: true, signedIn: true, channels: [],
      standings: [{ id: 's1', role: 'platform-administrator' }], standing: 's1',
    })
    const stable = viewer.getSnapshot()
    expect(viewer.getSnapshot()).toBe(stable)
    off()
  })

  it('puts a standing in force through the viewer service, and does nothing without one', async () => {
    const acted: string[] = []
    const { ctx } = await bench('/admin', {}, {
      load: async () => {},
      act: (standing: string) => { acted.push(standing); return Promise.resolve(true) },
      state: {
        getSnapshot: () => ({
          status: 'ready',
          viewer: {
            accounts: true,
            person: { id: 'p1', displayName: '张工' },
            standings: [
              { id: 'zhang:platform', role: 'platform-administrator' },
              { id: 'zhang:acme', role: 'tenant-administrator', organization: 'acme' },
            ],
            channels: [],
            signInPrefix: '/auth/sign-in',
            signOutPath: '/auth/sign-out',
          },
          administers: false,
        }),
        subscribe: () => () => {},
      },
    })
    const row = injectedOf(ctx).hooks.viewer.getSnapshot()
    // Both offered, neither in force: the frame asks before it offers a page.
    expect(row.standings).toEqual([
      { id: 'zhang:platform', role: 'platform-administrator' },
      { id: 'zhang:acme', role: 'tenant-administrator', organization: 'acme' },
    ])
    expect(row.standing).toBeUndefined()

    injectedOf(ctx).act('zhang:acme')
    expect(acted).toEqual(['zhang:acme'])

    // And where no viewer service is mounted there is nothing to switch
    // between, so the same call is a no-op rather than a failure.
    const plain = await bench('/admin')
    expect(() => { injectedOf(plain.ctx).act('zhang:acme') }).not.toThrow()
  })

  it('offers no channel when the deployment configured none', async () => {
    const { ctx } = await bench('/admin', {}, {
      load: async () => {},
      state: {
        getSnapshot: () => ({
          status: 'ready',
          viewer: {
            accounts: true, channels: [], standings: [],
            signInPrefix: '/auth/sign-in', signOutPath: '/auth/sign-out',
          },
          administers: false,
        }),
        subscribe: () => () => {},
      },
    })
    const row = injectedOf(ctx).hooks.viewer.getSnapshot()
    expect(row.channels).toEqual([])
    expect(row).toMatchObject({ accounts: true, signedIn: false })
  })

  it('offers no sign-out to a page nobody is signed in on', async () => {
    const { ctx } = await bench('/admin', {}, {
      load: async () => {},
      state: {
        getSnapshot: () => ({
          status: 'ready',
          viewer: {
            accounts: true,
            channels: [
              { id: 'oidc', displayName: 'Single sign-on', redirect: true },
              { id: 'desktop', displayName: 'This device', redirect: false },
            ],
            standings: [],
            signInPrefix: '/auth/sign-in',
            signOutPath: '/auth/sign-out',
          },
          administers: false,
        }),
        subscribe: () => () => {},
      },
    })
    // Nobody signed in: the console offers the channels a browser can begin,
    // and leaves a self-driven one out because a page cannot start it.
    expect(injectedOf(ctx).hooks.viewer.getSnapshot()).toEqual({
      name: undefined, signOutPath: undefined, administers: false, accounts: true, signedIn: false,
      channels: [{ href: '/auth/sign-in/oidc', displayName: 'Single sign-on' }],
      standings: [], standing: undefined,
    })
  })
})
