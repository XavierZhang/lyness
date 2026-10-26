/**
 * Register the history section into Settings.
 *
 * The entries come from the deployment the client connected to, read through
 * `remote.audit`. The read names no organization: the namespace resolves the
 * one the caller's standing administers, so this surface has no organization
 * field to get wrong.
 *
 * The call lives here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-history/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-admin-audit-controller/remote'
import { HistorySection } from './HistorySection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createHistoryOperations, historyCallsOf } from './operations.ts'
import { createHistorySectionStore } from './store.ts'
import { en, zh } from './locales.ts'
import type { HistoryKey } from './locales.ts'

export type { HistoryKey } from './locales.ts'
export type { HistorySectionInjected, HistorySectionProps } from './HistorySection.tsx'
export { actionLabel, kindLabel } from './HistorySection.tsx'
export { createHistorySectionStore } from './store.ts'
export type { HistorySectionState, HistoryStatus } from './store.ts'
export { createHistoryOperations, historyCallsOf, statusOf } from './operations.ts'
export type { CallOutcome, HistoryCalls, HistoryOperations, HistorySink } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { HistoryActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.history': HistoryKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.history'

/** Services required by the history section. */
export const inject = ['slots', 'locale', 'remote', 'remote.audit']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'history: dictionaries')
  const store = createHistorySectionStore()
  const binding = new SectionBinding()
  const operations = createHistoryOperations(historyCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'history',
    // After the bots: the history is what those two sections changed, so it
    // is read after the records it describes.
    order: 50,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, HistorySection))
}
