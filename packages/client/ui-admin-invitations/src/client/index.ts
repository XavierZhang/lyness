/**
 * Register the invitations page into the administration console.
 *
 * The invitations come from the deployment the client connected to, read
 * through `remote.invitations`. The code of a new one is in the answer that
 * issued it and nowhere else, so the page shows it once and the store holds
 * it no longer than the administrator stays.
 *
 * The calls live here rather than in the component so one in-flight read is
 * shared: opening the page twice does not ask the deployment twice.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-invitations/client
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-invitations-controller/remote'
import { InvitationsPage } from './InvitationsPage.tsx'
import { PageBinding, pageFace } from './binding.ts'
import { createInvitationsOperations, invitationCallsOf } from './operations.ts'
import { createInvitationsPageStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { InvitationsKey } from './locales.ts'

export type { InvitationsKey } from './locales.ts'
export type { InvitationsPageInjected, InvitationsPageProps } from './InvitationsPage.tsx'
export { createInvitationsPageStore } from './store.ts'
export type {
  InvitationsOutcome, InvitationsPageState, InvitationsStatus,
} from './store.ts'
export { createInvitationsOperations, invitationCallsOf, statusOf } from './operations.ts'
export type {
  CallOutcome, InvitationsCalls, InvitationsOperations, InvitationsSink,
} from './operations.ts'
export { PageBinding, pageFace } from './binding.ts'
export type { InvitationsActions } from './binding.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'admin.invitations': InvitationsKey }
}

/** The locale namespace this page's copy lives in. */
export const NS = 'admin.invitations'

/** Where a redemption link sends somebody, unless the deployment serves it elsewhere. */
export const DEFAULT_JOIN_PATH = '/join'

/** What this page reads from its composition. */
export interface Config {
  /**
   * The path the redemption page is served at, which the copied link carries
   * the code to as its `invite` parameter. It is the deployment's own choice,
   * because the page that answers it is a row of the same composition.
   */
  joinPath?: string
}

export const Config: z<Config> = z.object({
  joinPath: z.string().default(DEFAULT_JOIN_PATH),
})

/** Services required by the invitations page. */
export const inject = ['slots', 'locale', 'remote', 'remote.invitations']

/**
 * Register the page.
 * @param ctx - client plugin context.
 * @param config - where a redemption link sends somebody.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'invitations: dictionaries')
  const store = createInvitationsPageStore()
  const binding = new PageBinding()
  const operations = createInvitationsOperations(invitationCallsOf(ctx), binding)
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('admin.section', () => ctx.slots.register({
    name: 'admin.section',
    id: 'invitations',
    // After the people: an invitation is how somebody who is not in that
    // roster yet gets into it, so the roster is what an administrator reads
    // first.
    order: 36,
    label: () => t('nav'),
    store,
    locale: NS,
    inject: pageFace(binding, operations, config.joinPath ?? DEFAULT_JOIN_PATH),
  }, InvitationsPage))
}
