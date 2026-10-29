/**
 * Register the "what you may use" section into the personal plane of
 * Settings.
 *
 * It is a personal page that carries no control: in this product the models,
 * connections, skills and tools are composed by a deployment, so the honest
 * personal entry says what a reader has and who decided it rather than
 * offering a setting the next call would refuse. It is the one answer to the
 * question four administration pages otherwise answer with a refusal notice.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-capabilities/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-agent-capabilities-controller/remote'
import { CapabilitiesSection } from './CapabilitiesSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { capabilitiesCallsOf, createCapabilitiesOperations } from './operations.ts'
import { createCapabilitiesSectionStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { CapabilitiesKey } from './locales.ts'

export type { CapabilitiesKey } from './locales.ts'
export type { CapabilitiesSectionInjected, CapabilitiesSectionProps } from './CapabilitiesSection.tsx'
export { createCapabilitiesSectionStore } from './store.ts'
export type { CapabilitiesRead, CapabilitiesSectionState, CapabilitiesStatus } from './store.ts'
export { capabilitiesCallsOf, createCapabilitiesOperations } from './operations.ts'
export type {
  CallOutcome, CapabilitiesCalls, CapabilitiesOperations, CapabilitiesSink,
} from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { CapabilitiesActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.capabilities': CapabilitiesKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.capabilities'

/** Services required by the capabilities section. */
export const inject = ['slots', 'locale', 'remote', 'remote.agentCapabilities', 'remote.session']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'capabilities: dictionaries')
  const store = createCapabilitiesSectionStore()
  const binding = new SectionBinding()
  const operations = createCapabilitiesOperations(capabilitiesCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'capabilities',
    // Last of the personal plane: what a person told their agents and what
    // those agents kept are theirs to change, and this is what somebody else
    // decided for them.
    order: 30,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, CapabilitiesSection))
}
