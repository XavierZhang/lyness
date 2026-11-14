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
import memoriesRemote from '@lyness/lyn-api-memory-controller/remote'
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
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the namespace and register the section while it is there.
 *
 * The namespace is mounted here rather than in the client's core Remote
 * assembly: this package is its only consumer, so the page and the call it
 * makes arrive and leave together.
 * @param ctx - client plugin context.
 * @returns the disposer, which withdraws the section before the namespace.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(memoriesRemote)
  const section = ctx.inject(['remote.memories'], (scope: Context) => {
    scope.effect(() => scope.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'memory: dictionaries')
    const store = createMemorySectionStore()
    const binding = new SectionBinding()
    const operations = createMemoryOperations(memoryCallsOf(scope), binding)
    const t = scope.locale.bind(NS)

    scope.slots.inject('settings.section', () => scope.slots.register({
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
  })
  return async () => {
    await section.dispose()
    await unmount()
  }
}
