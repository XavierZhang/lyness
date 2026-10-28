/**
 * Register the announcements row into General Settings.
 *
 * The announcements come from the deployment the client connected to, read
 * through `remote.announcements`. A desktop install and a browser reach their
 * own server, so what they read is whatever that deployment publishes rather
 * than anything baked into a client bundle.
 *
 * The read lives here rather than in the component so one in-flight read is
 * shared: opening the reader twice does not ask the deployment twice.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-announcements/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-announcement-controller/remote'
import { AnnouncementsRow } from './AnnouncementsRow.tsx'
import { RowBinding, rowFace } from './binding.ts'
import { announcementsReadOf, createAnnouncementsReader } from './read.ts'
import { createAnnouncementsRowStore } from './settings-store.ts'
import { en, zh } from './locales.ts'
import type { AnnouncementsKey } from './locales.ts'

export type { AnnouncementsKey } from './locales.ts'
export type { AnnouncementsRowInjected, AnnouncementsRowProps } from './AnnouncementsRow.tsx'
export { createAnnouncementsRowStore } from './settings-store.ts'
export type { AnnouncementsRowState } from './settings-store.ts'
export { announcementsReadOf, createAnnouncementsReader } from './read.ts'
export type { AnnouncementsReader, ReadOutcome, ReaderSink } from './read.ts'
export { RowBinding, rowFace } from './binding.ts'
export type { AnnouncementActions } from './binding.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.announcements': AnnouncementsKey }
}

/** The locale namespace this row's copy lives in. */
export const NS = 'settings.announcements'

/** Services required by the announcements row. */
export const inject = ['slots', 'locale', 'remote', 'remote.announcements']

/**
 * Register the row.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'announcements: dictionaries')
  const store = createAnnouncementsRowStore()
  const binding = new RowBinding()
  const reader = createAnnouncementsReader(announcementsReadOf(ctx), binding)

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'announcements',
    // After the current-version row, because a reader arrives at the version
    // first and reads what changed from there.
    order: 30,
    store,
    locale: NS,
    inject: rowFace(binding, reader),
  }, AnnouncementsRow))
}
