/**
 * Which Settings plane a viewer may see, decided from one viewer read.
 *
 * The split is navigation, not authority: every administrative call keeps its
 * own check, so this predicate decides what a person is offered and never
 * what they may do.
 *
 * @module @lyness/lyn-client-ui-viewer/client/plane
 */

import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'

/** The two groups the Settings navigation presents. */
export type SettingsPlane = 'personal' | 'administration'

/**
 * Whether this viewer administers something this deployment keeps.
 *
 * A deployment with no accounts answers true: nobody signs in and nobody is
 * refused, so hiding the administration plane there would hide the operator's
 * own pages from the only person who has them. A deployment with accounts
 * answers true for a standing above `member`, and false for a member and for
 * a personal context, which holds no standing at all.
 * @param viewer - the answer one `identity.viewer()` read returned, or
 * undefined while no read has answered yet.
 * @returns true when the administration plane belongs to this viewer.
 */
export function administers(viewer: ViewerView | undefined): boolean {
  if (viewer === undefined) return false
  if (!viewer.accounts) return true
  return viewer.standing !== undefined && viewer.standing.role !== 'member'
}
