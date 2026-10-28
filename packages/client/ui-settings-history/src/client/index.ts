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
 * @module @deepseek-ai/dsh-client-ui-settings-history/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-admin-audit-controller/remote'
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
export {
  createHistoryOperations, EXPORT_FILE_NAME, historyCallsOf, MAX_EXPORT_ENTRIES, statusOf, trailFile,
} from './operations.ts'
export type {
  CallOutcome, DeliverFile, ExportOutcome, HistoryCalls, HistoryOperations, HistorySink,
} from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { HistoryActions } from './binding.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.history': HistoryKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.history'

/**
 * Hand one finished file to the reader, the way the browser does.
 *
 * The product's own window has no download handler of its own, so the
 * browser and the desktop shell both save it where that platform saves
 * downloads. Exported as a named function so the section's own tests assert
 * what was written without a document to click in.
 * @param name - the file name to offer it under.
 * @param contents - the file's text.
 */
export function deliverDownload(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/x-ndjson' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Released on the next tick rather than immediately: a click that has not
  // been handled yet still needs the object alive.
  setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}

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
  const operations = createHistoryOperations(historyCallsOf(ctx), binding, deliverDownload)
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
