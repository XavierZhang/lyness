/**
 * Register the bots section into Settings.
 *
 * The bots come from the deployment the client connected to, read through
 * `remote.bots`, and so do the presets one may be given: capabilities are
 * chosen from what the deployment offers, and the same namespace answers
 * both so a form never offers a choice the server would refuse.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-bots/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-bots-controller/remote'
import { BotsSection } from './BotsSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { botsCallsOf, createBotsOperations } from './operations.ts'
import { createBotsSectionStore } from './store.ts'
import { en, zh } from './locales.ts'
import type { BotsKey } from './locales.ts'

export type { BotsKey } from './locales.ts'
export type { BotsSectionInjected, BotsSectionProps } from './BotsSection.tsx'
export { createBotsSectionStore } from './store.ts'
export type { BotsOutcome, BotsRead, BotsSectionState, BotsStatus } from './store.ts'
export { botsCallsOf, createBotsOperations, statusOf } from './operations.ts'
export type { BotsCalls, BotsOperations, BotsSink, CallOutcome } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { BotsActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.bots': BotsKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.bots'

/** Services required by the bots section. */
export const inject = ['slots', 'locale', 'remote', 'remote.bots']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'bots: dictionaries')
  const store = createBotsSectionStore()
  const binding = new SectionBinding()
  const operations = createBotsOperations(botsCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'bots',
    // After the people: a bot holds a standing in the same roster, and who
    // the deployment's people are is read before what it runs on their behalf.
    order: 40,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, BotsSection))
}
