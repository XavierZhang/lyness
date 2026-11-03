/**
 * Register the data section into the personal plane of Settings.
 *
 * It is a personal page because both controls are the person's own: a copy of
 * their conversation, and its removal. Nobody else decides either, and the
 * one thing the page cannot do — keep a deleted conversation's uploaded bytes
 * from being shared with another conversation — it says rather than implies.
 *
 * The namespace is mounted here rather than in the client's core Remote
 * assembly: this package is the only consumer, so the page and the call it
 * makes arrive and leave together.
 *
 * @module @lyness/lyn-client-ui-settings-data/client
 */

import type { Context } from '@lyness/cordis'
import { SessionId } from '@lyness/lyn-session/types'
import { createSnapshotStore } from '@lyness/lyn-client-store'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-session-controller/client'
import type {} from '@lyness/lyn-session-log-export/client'
import sessionDataRemote from '@lyness/lyn-api-session-data-controller/remote'
import { DataSection } from './DataSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createDataOperations, dataCallsOf } from './operations.ts'
import { conversationRows } from './rows.ts'
import { createDataSectionStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { DataKey } from './locales.ts'

export type { DataKey } from './locales.ts'
export type { DataSectionInjected, DataSectionProps } from './DataSection.tsx'
export { createDataSectionStore } from './store.ts'
export type { DataSectionState } from './store.ts'
export { createDataOperations, dataCallsOf } from './operations.ts'
export type { CallOutcome, DataCalls, DataOperations, DataSink } from './operations.ts'
export { conversationRows } from './rows.ts'
export type { ConversationRow, ConversationSource } from './rows.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { DataActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.data': DataKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.data'

/** Services required by the data section. */
export const inject = ['slots', 'locale', 'remote', 'sessions']

/**
 * Mount the namespace and register the section while it is there.
 * @param ctx - client plugin context.
 * @returns the disposer, which withdraws the section before the namespace.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(sessionDataRemote)
  const section = ctx.inject(['remote.sessionData'], (scope: Context) => {
    scope.effect(() => scope.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'settings-data: dictionaries')
    const store = createDataSectionStore()
    const binding = new SectionBinding()
    const operations = createDataOperations(dataCallsOf(scope), binding)
    const conversations = conversationRows(scope.sessions)
    // The download belongs to another plugin, which a deployment may leave
    // out. Following it keeps the control and the page's own sentence about
    // it on one answer instead of two.
    const exportAvailable = createSnapshotStore(false)
    scope.inject(['sessionLogDownload'], (withDownload: Context) => {
      withDownload.effect(() => {
        exportAvailable.set(true)
        return () => { exportAvailable.set(false) }
      }, 'settings-data: download availability')
    })
    const t = scope.locale.bind(NS)
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section',
      id: 'data',
      // Last of the personal plane: the instructions a person gives, then
      // what was kept, then what they may use, then what they can take away.
      order: 40,
      label: () => t('nav'),
      store,
      locale: NS,
      inject: sectionFace(binding, operations, { conversations, exportAvailable }, (id: string) => {
        // The download plugin can unload between the render and this click.
        void scope.get('sessionLogDownload')?.download(SessionId(id))
      }),
    }, DataSection))
  })
  return async () => {
    await section.dispose()
    await unmount()
  }
}
