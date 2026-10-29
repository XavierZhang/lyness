/**
 * Register the instructions section into the personal plane of Settings.
 *
 * It is a personal page because the control is the person's own: nobody else
 * sets what they tell their agents, and nothing here reports a decision
 * somebody made for them.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-settings-instructions/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-personal-instructions-controller/remote'
import { InstructionsSection } from './InstructionsSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { createInstructionsOperations, instructionsCallsOf } from './operations.ts'
import { createInstructionsSectionStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { InstructionsKey } from './locales.ts'

export type { InstructionsKey } from './locales.ts'
export type { InstructionsSectionInjected, InstructionsSectionProps } from './InstructionsSection.tsx'
export { createInstructionsSectionStore } from './store.ts'
export type { InstructionsSectionState, InstructionsStatus, SaveOutcome } from './store.ts'
export { createInstructionsOperations, instructionsCallsOf } from './operations.ts'
export type {
  CallOutcome, InstructionsCalls, InstructionsOperations, InstructionsSink,
} from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { InstructionsActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.instructions': InstructionsKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.instructions'

/** Services required by the instructions section. */
export const inject = ['slots', 'locale', 'remote', 'remote.personalInstructions']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'instructions: dictionaries')
  const store = createInstructionsSectionStore()
  const binding = new SectionBinding()
  const operations = createInstructionsOperations(instructionsCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'instructions',
    // After General and the account row it sits beside: who this is comes
    // before what they told their agents.
    order: 10,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, InstructionsSection))
}
