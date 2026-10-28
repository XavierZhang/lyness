/**
 * Register the credits section into Settings.
 *
 * The balance and the ledger come from the deployment the client connected
 * to, read through `remote.credits`. A desktop install and a browser reach
 * their own server, so what they read is that deployment's ledger rather than
 * anything a client bundle carries.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-credits/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-credits-controller/remote'
import { CreditsSection } from './CreditsSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createCreditsOperations, creditsCallsOf } from './operations.ts'
import { createCreditsSectionStore } from './store.ts'
import { en, zh } from './locales.ts'
import type { CreditsKey } from './locales.ts'

export type { CreditsKey } from './locales.ts'
export type { CreditsSectionInjected, CreditsSectionProps } from './CreditsSection.tsx'
export { createCreditsSectionStore } from './store.ts'
export type { CreditsSectionState, CreditsStatus } from './store.ts'
export { createCreditsOperations, creditsCallsOf } from './operations.ts'
export type { CallOutcome, CreditsCalls, CreditsOperations, CreditsSink } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { CreditsActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.credits': CreditsKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.credits'

/** Services required by the credits section. */
export const inject = ['slots', 'locale', 'remote', 'remote.credits']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'credits: dictionaries')
  const store = createCreditsSectionStore()
  const binding = new SectionBinding()
  const operations = createCreditsOperations(creditsCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'credits',
    // After the models section, because what a model costs is read after
    // which models this deployment offers.
    order: 20,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, CreditsSection))
}
