/**
 * Register the people section into Settings.
 *
 * The directory comes from the deployment the client connected to, read
 * through `remote.people`; the channels a binding may name come from
 * `remote.signInChannels`, because admitting somebody means naming the
 * channel that authenticates them.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-people/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-people-controller/remote'
import type {} from '@lyness/lyn-api-sign-in-channel-controller/remote'
import { PeopleSection } from './PeopleSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createPeopleOperations, peopleCallsOf } from './operations.ts'
import { createPeopleSectionStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { PeopleKey } from './locales.ts'

export type { PeopleKey } from './locales.ts'
export type { PeopleSectionInjected, PeopleSectionProps } from './PeopleSection.tsx'
export { createPeopleSectionStore } from './store.ts'
export type { PeopleOutcome, PeopleRead, PeopleSectionState, PeopleStatus } from './store.ts'
export { createPeopleOperations, peopleCallsOf, statusOf } from './operations.ts'
export type { CallOutcome, PeopleCalls, PeopleOperations, PeopleSink } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { PeopleActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.people': PeopleKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.people'

/** Services required by the people section. */
export const inject = ['slots', 'locale', 'remote', 'remote.people', 'remote.signInChannels']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'people: dictionaries')
  const store = createPeopleSectionStore()
  const binding = new SectionBinding()
  const operations = createPeopleOperations(peopleCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.administration.section', () => ctx.slots.register({
    name: 'settings.administration.section',
    id: 'people',
    // After the sign-in channels: admitting somebody names the channel that
    // authenticates them, so the channel is configured first.
    order: 35,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, PeopleSection))
}
