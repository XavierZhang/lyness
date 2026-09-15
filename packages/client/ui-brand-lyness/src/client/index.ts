/** lyness occupants for the generic browser-brand slots. */
import type { Context as ClientContext } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-ui-conversation/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-client-ui-sidebar/client'
import { LynessHeroMark, LynessSidebarMark, LynessSidebarName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand slots as one declaration-aware registration set, and
 * the conversation hero mark on its own declaration, which a different package
 * makes independently of the sidebar.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, LynessSidebarMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, LynessSidebarName)
    }))
  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.register({ name: 'conversation.hero.brand.mark' }, LynessHeroMark))
}
