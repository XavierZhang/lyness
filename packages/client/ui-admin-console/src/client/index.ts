/**
 * The administration console, browser half.
 *
 * It takes the page — the built-in `root` slot — when the document was served
 * at the console's own path, and registers nothing anywhere else. That is what
 * separates administration from the workbench: an administrator opens a URL of
 * its own and gets a surface with its own navigation, while a person using the
 * product never loads the console's chrome at all.
 *
 * `root` is a single slot, so this registration shadows the workbench frame on
 * that page rather than sitting beside it, which is exactly the intent. The
 * frame declares two seats: `admin.section`, where every administration page
 * registers, and `shell.overlay`, so the sign-in screen and a page's toasts
 * still have somewhere to appear.
 *
 * Which pages exist is the deployment's answer, not this package's: a
 * composition that mounts no administration module gets a console that says so.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-console/client
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the settings shell's SlotMap merge, which types the
// administration pages' own seat and owner share.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-viewer/client'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { AdminFrame } from './AdminFrame.tsx'
import type {
  AdminChannelRow, AdminFrameInjected, AdminSectionRow, AdminStandingRow, AdminViewerRow,
} from './AdminFrame.tsx'
import { createAdminConsoleStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { AdminConsoleKey } from './locales.ts'

export { AdminFrame, GROUPS, activeSection, groupSections } from './AdminFrame.tsx'
export type {
  AdminChannelRow, AdminFrameInjected, AdminFrameProps, AdminGroupKey, AdminSectionRow, AdminViewerRow,
} from './AdminFrame.tsx'
export { createAdminConsoleStore } from './store.ts'
export type { AdminConsoleState } from './store.ts'
export type { AdminConsoleKey } from './locales.ts'
export { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The console's own chrome: nav groups, header, and its empty state. */
    'admin.console': AdminConsoleKey
  }
}

/** The locale namespace this console's copy lives in. */
export const NS = 'admin.console' as const

/** Where the console lives, when a deployment does not say otherwise. */
export const DEFAULT_PATH = '/admin'

/**
 * Shadowing rank of the console's frame in the built-in `root` slot.
 *
 * Below the workbench frame's default rank, because the lowest rank renders
 * and on the console's page the console is what should render. It is a
 * constant rather than configuration: which frame owns a page is not a
 * deployment's choice, it is what the page is.
 */
export const ROOT_PRIORITY = -10

/** Which page this console answers on. */
export interface Config {
  /**
   * The pathname the console takes over, as the document was served at.
   *
   * It must match the `documentPaths` entry that makes the Host answer that
   * path with the application document: the Host decides which paths serve a
   * page, and this decides which of them is the console. One absolute segment,
   * because the served document resolves every app route against its own
   * directory.
   */
  path?: string
}

export const Config: z<Config> = z.object({
  path: z.string().default(DEFAULT_PATH),
})

/** Services the console's frame reads. */
export const inject = ['slots', 'locale']

/**
 * Whether this document is the console's page.
 *
 * The browser's own location, because the Host served this document at a path
 * it chose: asking the location is reading what the Host answered, which is
 * also what makes the console reachable by typing its URL.
 * @param path - the configured console path.
 * @param pathname - the document's pathname.
 * @returns true when the console owns this page.
 */
export function consolePage(path: string, pathname: string): boolean {
  const wanted = path.endsWith('/') ? path.slice(0, -1) : path
  return pathname === wanted || pathname === `${wanted}/`
}

/**
 * The administration pages currently offered, localized, in declared order.
 * @param ctx - client plugin context.
 * @returns a snapshot source the frame subscribes to.
 */
function sectionRows(ctx: Context): HostObservable<readonly AdminSectionRow[]> {
  let version = -1
  let revision = -1
  let rows: readonly AdminSectionRow[] = []
  return {
    getSnapshot: () => {
      const nextVersion = ctx.slots.getVersion('admin.section')
      const nextRevision = ctx.locale.getSnapshot().revision
      if (nextVersion !== version || nextRevision !== revision) {
        version = nextVersion
        revision = nextRevision
        rows = ctx.slots.entries('admin.section')
          .map(entry => ({
            /* v8 ignore next -- a list-slot registration requires an id */
            id: entry.options.id ?? '',
            order: entry.options.order ?? 0,
            label: labelOf(entry.options.label),
          }))
          .sort((a, b) => a.order - b.order)
      }
      return rows
    },
    subscribe: (listener) => {
      const offLedger = ctx.slots.subscribe('admin.section', listener)
      const offLocale = ctx.locale.subscribe(listener)
      return () => {
        offLedger()
        offLocale()
      }
    },
  }
}

/**
 * One page's own name, as its registration gives it.
 * @param label - the registered label, a string or a function returning one.
 * @returns the text to show, empty when the registration gives none.
 */
function labelOf(label: unknown): string {
  if (typeof label === 'string') return label
  if (typeof label !== 'function') return ''
  const resolved: unknown = (label as () => unknown)()
  return typeof resolved === 'string' ? resolved : ''
}

/** No channel at all, so an unchanged answer keeps its snapshot identity. */
const EMPTY_CHANNELS: readonly AdminChannelRow[] = []

/** No standing at all, for the same reason. */
const EMPTY_STANDINGS: readonly AdminStandingRow[] = []

/**
 * The channels the console's sign-in page offers, as links.
 *
 * Only the redirect ones: a self-driven channel completes in the process that
 * owns the browser, so a page cannot begin it, and offering it would be a
 * button that does nothing.
 * @param view - the viewer answer.
 * @returns one row per channel a browser can begin.
 */
function channelRows(view: ViewerView): readonly AdminChannelRow[] {
  const rows = view.channels
    .filter(channel => channel.redirect)
    .map((channel): AdminChannelRow => ({
      href: `${view.signInPrefix}/${channel.id}`,
      displayName: channel.displayName,
    }))
  return rows.length === 0 ? EMPTY_CHANNELS : rows
}

/**
 * What the console says when this deployment keeps no accounts.
 *
 * The person at the keyboard is its operator, so the console is theirs and
 * there is nobody to sign out.
 */
const NO_ACCOUNTS: AdminViewerRow = {
  name: undefined, signOutPath: undefined, administers: true,
  accounts: false, signedIn: false, channels: EMPTY_CHANNELS,
  standings: EMPTY_STANDINGS, standing: undefined,
}

/**
 * One standing the viewer holds, as the console offers it.
 * @param standing - the standing as the deployment reports it.
 * @returns the row the frame renders.
 */
function standingRow(standing: ViewerView['standings'][number]): AdminStandingRow {
  return {
    id: standing.id,
    role: standing.role,
    ...standing.organization === undefined ? {} : { organization: standing.organization },
  }
}

/**
 * Who the console says is viewing it.
 *
 * The viewer service owns the read; a composition without it has no accounts,
 * so the console names nobody and offers no sign-out — which is the
 * single-operator shape, where the person at the keyboard is the operator.
 *
 * The service is resolved per read rather than once: `apply` runs while the
 * client graph is still mounting, and a service looked up there is undefined
 * for no reason other than plugin order — which would make a deployment with
 * accounts render as one without any.
 * @param ctx - client plugin context.
 * @returns a snapshot source the frame subscribes to.
 */
function viewerRow(ctx: Context): HostObservable<AdminViewerRow> {
  let last: AdminViewerRow = {
    name: undefined, signOutPath: undefined, administers: false,
    accounts: false, signedIn: false, channels: EMPTY_CHANNELS,
    standings: EMPTY_STANDINGS, standing: undefined,
  }
  // Both lists are derived once per viewer answer: rebuilding them on every
  // read would hand React new arrays each time.
  let read: ViewerView | undefined
  let offered: readonly AdminChannelRow[] = EMPTY_CHANNELS
  let held: readonly AdminStandingRow[] = EMPTY_STANDINGS
  return {
    getSnapshot: () => {
      const viewer = ctx.get('uiViewer')
      if (viewer === undefined) return NO_ACCOUNTS
      const snapshot = viewer.state.getSnapshot()
      const view = snapshot.viewer
      const name = view?.person?.displayName
      const signedIn = view?.person !== undefined
      const accounts = view?.accounts === true
      const signOutPath = view !== undefined && accounts && signedIn ? view.signOutPath : undefined
      // While the read is still out, nothing is offered: a nav drawn from a
      // guess would flicker into a refusal.
      const administers = snapshot.administers
      if (view !== read) {
        read = view
        offered = view !== undefined && accounts && !signedIn ? channelRows(view) : EMPTY_CHANNELS
        held = view === undefined || view.standings.length === 0 ? EMPTY_STANDINGS : view.standings.map(standingRow)
      }
      const standing = view?.standing?.id
      if (name !== last.name || signOutPath !== last.signOutPath || administers !== last.administers
        || accounts !== last.accounts || signedIn !== last.signedIn || offered !== last.channels
        || held !== last.standings || standing !== last.standing) {
        last = {
          name, signOutPath, administers, accounts, signedIn,
          channels: offered, standings: held, standing,
        }
      }
      return last
    },
    subscribe: (listener) => {
      const viewer = ctx.get('uiViewer')
      if (viewer === undefined) return () => {}
      void viewer.load()
      return viewer.state.subscribe(listener)
    },
  }
}

/**
 * Put one of the viewer's own standings in force.
 *
 * The viewer service owns the change as it owns the read, so every surface
 * showing who is viewing moves together; a composition without it has no
 * accounts and nothing to switch between.
 * @param ctx - client plugin context.
 * @returns the operation the frame calls.
 */
function acting(ctx: Context): (standing: string) => void {
  return (standing: string): void => {
    void ctx.get('uiViewer')?.act(standing)
  }
}

/**
 * Take the page when it is the console's, and nothing otherwise.
 * @param ctx - client plugin context.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  if (!consolePage(config.path ?? DEFAULT_PATH, location.pathname)) return
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'admin console: dictionaries')
  ctx.effect(() => {
    const handle = createAdminConsoleStore()
    const instance = handle.create()
    const store: typeof handle = { ...handle, create: () => instance }
    const sections = sectionRows(ctx)
    const viewer = viewerRow(ctx)
    const act = acting(ctx)
    return ctx.slots.register({
      name: 'root',
      // `root` is a single slot and the workbench frame holds it at the
      // default rank; the lowest priority renders, so this takes the page.
      // Two registrations at one rank are a composition error the registry
      // refuses, which is what keeps an accidental second frame from
      // shadowing silently.
      priority: ROOT_PRIORITY,
      locale: NS,
      children: {
        'admin.section': { kind: 'list', scope: 'root' },
      },
      store,
      inject: (): AdminFrameInjected => ({ hooks: { sections, viewer }, act }),
    }, AdminFrame)
  }, 'admin console: the page')
}
