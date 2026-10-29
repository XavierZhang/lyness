/**
 * Register the memory section into the personal plane of Settings.
 *
 * It is a personal page because the control is the person's own: nobody else
 * decides what is remembered about them, and nothing here reports a decision
 * somebody made for them. The deployment's shared memories are an
 * administrator's and are not listed.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-memory/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-memory-controller/remote'
import { MemorySection } from './MemorySection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createMemoryOperations, memoryCallsOf } from './operations.ts'
import { createMemorySectionStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { MemoryKey } from './locales.ts'

export type { MemoryKey } from './locales.ts'
export type { MemorySectionInjected, MemorySectionProps } from './MemorySection.tsx'
export { createMemorySectionStore } from './store.ts'
export type { MemorySectionState, MemoryStatus } from './store.ts'
export { createMemoryOperations, memoryCallsOf } from './operations.ts'
export type { CallOutcome, MemoryCalls, MemoryOperations, MemorySink } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { MemoryActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.memory': MemoryKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.memory'

/** Services required by the memory section. */
export const inject = ['slots', 'locale', 'remote', 'remote.memories']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'memory: dictionaries')
  const store = createMemorySectionStore()
  const binding = new SectionBinding()
  const operations = createMemoryOperations(memoryCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'memory',
    // After the instructions: what a person told their agents comes before
    // what those agents kept.
    order: 20,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, MemorySection))
}
