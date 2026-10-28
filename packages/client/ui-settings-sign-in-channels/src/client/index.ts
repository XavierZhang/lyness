/**
 * Register the sign-in channels section into Settings.
 *
 * The kinds and the records come from the deployment the client connected
 * to, read through `remote.signInChannels`. A desktop install and a browser
 * reach their own server, so what each configures is that deployment's own
 * channels rather than anything a client bundle carries.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the section twice does not ask the deployment twice.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-sign-in-channels/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-sign-in-channel-controller/remote'
import { ChannelsSection } from './ChannelsSection.tsx'
import { SectionBinding, sectionFace } from './binding.ts'
import { channelsCallsOf, createChannelsOperations } from './operations.ts'
import { createChannelsSectionStore } from './store.ts'
import { en, zh } from './locales.ts'
import type { ChannelsKey } from './locales.ts'

export type { ChannelsKey } from './locales.ts'
export type { ChannelsSectionInjected, ChannelsSectionProps } from './ChannelsSection.tsx'
export { createChannelsSectionStore } from './store.ts'
export type { ChannelsOutcome, ChannelsRead, ChannelsSectionState, ChannelsStatus } from './store.ts'
export { channelsCallsOf, createChannelsOperations, statusOf } from './operations.ts'
export type { CallOutcome, ChannelsCalls, ChannelsOperations, ChannelsSink } from './operations.ts'
export { SectionBinding, sectionFace } from './binding.ts'
export type { ChannelsActions } from './binding.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.sign-in-channels': ChannelsKey }
}

/** The locale namespace this section's copy lives in. */
export const NS = 'settings.sign-in-channels'

/** Services required by the sign-in channels section. */
export const inject = ['slots', 'locale', 'remote', 'remote.signInChannels']

/**
 * Register the section.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'sign-in channels: dictionaries')
  const store = createChannelsSectionStore()
  const binding = new SectionBinding()
  const operations = createChannelsOperations(channelsCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'sign-in-channels',
    // After credits, because how people sign in is an administrator's
    // concern and the sections above it are every reader's.
    order: 30,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: sectionFace(binding, operations),
  }, ChannelsSection))
}
