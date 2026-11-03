/**
 * The shell's one decision about an optional service: whether to offer the
 * administration plane, and who drives the read behind that answer.
 *
 * It is its own unit because the behaviour worth pinning is not the slot
 * registration — a composition with no directory offering every plane, and a
 * shell that asks once however often it remounts.
 *
 * @module @lyness/lyn-client-ui-settings-general/client/administers
 */

import type { HostObservable } from '@lyness/lyn-client-ui-slots'

/**
 * What the shell reads from the viewer service: the shared read it drives and
 * the plane that read decides. Narrower than the service itself, so this unit
 * neither depends on the rest of it nor needs one to be stood up in a test.
 */
export interface ViewerPlaneSource {
  /** Read who the viewer is, or join the read already running. */
  load: () => Promise<void>
  /** The shared snapshot, of which only the derived plane is read here. */
  state: HostObservable<{ administers: boolean }>
}

/**
 * Build the source the shell reads its plane decision from.
 *
 * A composition without the viewer service answers true and subscribes to
 * nothing: it has no directory to ask, so it has nobody to hide those pages
 * from, and the answer can never change.
 * @param viewer - the viewer service, when this composition mounted one.
 * @returns the observable the shell hands to its `hooks` compartment.
 */
export function administersSource(viewer: ViewerPlaneSource | undefined): HostObservable<boolean> {
  if (viewer === undefined) return { getSnapshot: () => true, subscribe: () => () => {} }
  let requested = false
  return {
    getSnapshot: () => viewer.state.getSnapshot().administers,
    // The shell is the first surface to need the answer and may be the only
    // one, so its first subscription drives the read. The flag keeps a
    // remount from asking again; a surface that wants a fresh answer calls
    // the service's own retry.
    subscribe: (listener) => {
      if (!requested) {
        requested = true
        void viewer.load()
      }
      return viewer.state.subscribe(listener)
    },
  }
}
