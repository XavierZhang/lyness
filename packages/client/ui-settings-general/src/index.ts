/** Welcome acknowledgement stored in the plugin configuration. */
import type {} from '@lyness/lyn-settings'

import type { Volatile, Context } from '@lyness/cordis'

import z from '@lyness/schemastery'

/** Runtime preferences projected to the browser. */
export interface Config {
  /**
   * Last acknowledged internal-testing notice version.
   *
   * No longer written: that notice was retired. The field stays declared
   * because profiles carry what an earlier build wrote, and a field this
   * build did not know would turn a readable profile into an unreadable one.
   */
  welcomeNoticeVersion: Volatile<string | undefined>
}

/** The retired notice's acknowledgement, kept readable for existing profiles. */
export const Config = z.object({
  welcomeNoticeVersion: z.string().volatile(),
})

/** The browser consumes the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
