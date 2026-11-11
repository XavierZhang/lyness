/**
 * Register the invitation page, on its own path and nowhere else.
 *
 * It takes the built-in `root` seat the way the administration console does:
 * whoever follows an invitation link has no account here yet, so the
 * workbench frame would be a product they cannot use. On every other path
 * this plugin registers nothing.
 *
 * The code is read from the page's own query string and goes no further than
 * the sign-in links this page builds. Nothing here asks the deployment
 * whether the code is good: an answer to that question, on a page anybody can
 * open, would tell whoever asked which codes exist.
 *
 * @module @lyness/lyn-client-ui-join/client
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-client-ui-viewer/client'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import type { HostObservable } from '@lyness/lyn-client-ui-slots'
import { JoinPage } from './JoinPage.tsx'
import type { JoinChannelRow, JoinPageInjected, JoinVisitRow } from './JoinPage.tsx'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { JoinKey } from './locales.ts'

export type { JoinKey } from './locales.ts'
export { JoinPage, blockedBy } from './JoinPage.tsx'
export type { JoinChannelRow, JoinPageInjected, JoinPageProps, JoinVisitRow } from './JoinPage.tsx'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { join: JoinKey }
}

/** The locale namespace this page's copy lives in. */
export const NS = 'join'

/** The path this page takes over, unless the deployment serves it elsewhere. */
export const DEFAULT_PATH = '/join'

/** The query parameter the invitation link carries the code in. */
export const CODE_PARAMETER = 'invite'

/**
 * Priority of this page's `root` registration.
 *
 * `root` is a single slot and the lowest priority renders, so a lower one
 * than the workbench frame's is what puts this page in its place. A constant
 * rather than configuration: which frame owns a page is not a deployment's
 * choice, it is what the page is.
 */
export const ROOT_PRIORITY = -10

/** Which page this one answers on. */
export interface Config {
  /**
   * The pathname this page takes over, as the document was served at.
   *
   * It must match the `documentPaths` entry that makes the Host answer that
   * path with the application document, and the `joinPath` the administration
   * page builds its links with: the Host decides which paths serve a page,
   * and this decides which of them carries an invitation.
   */
  path?: string
}

export const Config: z<Config> = z.object({
  path: z.string().default(DEFAULT_PATH),
})

/** Services this page reads. */
export const inject = ['slots', 'locale']

/**
 * Whether this document is the invitation page.
 *
 * The browser's own location, because the Host served this document at a path
 * it chose: asking the location is reading what the Host answered.
 * @param path - the configured page path.
 * @param pathname - the document's pathname.
 * @returns true when this page owns the document.
 */
export function joinPage(path: string, pathname: string): boolean {
  const wanted = path.endsWith('/') ? path.slice(0, -1) : path
  return pathname === wanted || pathname === `${wanted}/`
}

/**
 * The code this visit carries, if it carries one.
 * @param search - the document's query string.
 * @returns the code, or undefined when the link carried none.
 */
export function codeOf(search: string): string | undefined {
  const value = new URLSearchParams(search).get(CODE_PARAMETER)
  return value === null || value === '' ? undefined : value
}

/** No channel at all, so an unchanged answer keeps its snapshot identity. */
const EMPTY_CHANNELS: readonly JoinChannelRow[] = []

/**
 * The directories this page offers, each link already carrying the code.
 *
 * Only the redirect ones: a self-driven channel completes in the process that
 * owns the browser, so a page cannot begin it, and offering it would be a
 * link that does nothing.
 * @param view - the viewer answer.
 * @param code - the code this visit carries.
 * @returns one row per directory a browser can begin.
 */
export function channelRows(view: ViewerView, code: string): readonly JoinChannelRow[] {
  const rows = view.channels
    .filter(channel => channel.redirect)
    .map((channel): JoinChannelRow => ({
      href: `${view.signInPrefix}/${channel.id}?${CODE_PARAMETER}=${encodeURIComponent(code)}`,
      displayName: channel.displayName,
    }))
  return rows.length === 0 ? EMPTY_CHANNELS : rows
}

/**
 * What this page knows about the visit.
 *
 * The viewer service owns the read; a composition without it has no accounts,
 * so there is nobody an invitation could admit and the page says so.
 * @param ctx - client plugin context.
 * @param code - the code this visit carries, if any.
 * @returns a snapshot source the page subscribes to.
 */
export function visitRow(ctx: Context, code: string | undefined): HostObservable<JoinVisitRow> {
  const invited = code !== undefined
  const viewer = ctx.get('uiViewer')
  if (viewer === undefined || code === undefined) {
    const absent: JoinVisitRow = { invited, accounts: false, signedIn: false, channels: EMPTY_CHANNELS }
    return { getSnapshot: () => absent, subscribe: () => () => {} }
  }
  let last: JoinVisitRow = { invited, accounts: false, signedIn: false, channels: EMPTY_CHANNELS }
  // The rows are derived once per viewer answer: rebuilding them on every
  // read would hand React a new array each time, which is the one thing a
  // snapshot source may not do.
  let read: ViewerView | undefined
  let rows: readonly JoinChannelRow[] = EMPTY_CHANNELS
  return {
    getSnapshot: () => {
      const view = viewer.state.getSnapshot().viewer
      const signedIn = view?.person !== undefined
      const accounts = view?.accounts === true
      if (view !== read) {
        read = view
        rows = view !== undefined && accounts && !signedIn ? channelRows(view, code) : EMPTY_CHANNELS
      }
      if (accounts !== last.accounts || signedIn !== last.signedIn || rows !== last.channels) {
        last = { invited, accounts, signedIn, channels: rows }
      }
      return last
    },
    subscribe: (listener) => {
      void viewer.load()
      return viewer.state.subscribe(listener)
    },
  }
}

/**
 * Take the page when it is this one's, and nothing otherwise.
 * @param ctx - client plugin context.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  if (!joinPage(config.path ?? DEFAULT_PATH, location.pathname)) return
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'join: dictionaries')
  const visit = visitRow(ctx, codeOf(location.search))
  ctx.effect(() => ctx.slots.register({
    name: 'root',
    priority: ROOT_PRIORITY,
    locale: NS,
    inject: (): JoinPageInjected => ({ hooks: { visit } }),
  }, JoinPage))
}
