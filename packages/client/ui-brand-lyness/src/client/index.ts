/** lyness occupants for the generic browser-brand slots. */
import type { Context as ClientContext } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-ui-conversation/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-client-ui-sidebar/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@lyness/lyn-client-locale/client'
import { LynessAttribution, LynessHeroMark, LynessSidebarMark, LynessSidebarName } from './Brand.tsx'
import { en, zh } from './locales.ts'

export type { BrandAttributionKey } from './locales.ts'

/** Locale namespace of the attribution line. */
const NS = 'brandAttribution'

/** Required services: the UI slot registry and the locale registry. */
export const inject = ['slots', 'locale']

/**
 * Fill the sidebar brand slots as one declaration-aware registration set, the
 * conversation hero mark on its own declaration, which a different package
 * makes independently of the sidebar, and the attribution line on its own.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-brand-lyness: dictionaries')
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, LynessSidebarMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, LynessSidebarName)
    }))
  // The attribution names the platform rather than the brand, so it installs on
  // its own declaration: a shell without the seat simply shows no line.
  ctx.slots.inject('sidebar.attribution', () =>
    ctx.slots.register({ name: 'sidebar.attribution', locale: NS }, LynessAttribution))
  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.register({ name: 'conversation.hero.brand.mark' }, LynessHeroMark))
}
