/**
 * The join between the read and the stores the framework bakes.
 *
 * Two surfaces register, so two stores are baked, and one read has to reach
 * both: a viewer who signs in must see the screen go away and the row fill in
 * from the same answer. The actions also arrive later than the read does, so
 * a read that settles before a render publishes to whoever is bound by then
 * rather than failing.
 *
 * @module @deepseek-ai/dsh-client-ui-sign-in/client/binding
 */

import type { SharedRead } from '@deepseek-ai/dsh-client-store'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import type { ViewerSink } from './read.ts'

/** The store writes a surface performs, as the framework hands them over. */
export type ViewerActions = ViewerSink

/** Publishes read outcomes to every baked store, once there is one. */
export class ViewerBinding implements ViewerSink {
  private readonly bound = new Set<ViewerActions>()

  /**
   * Take the store writes the framework baked for one surface.
   * @param actions - the bound actions.
   * @returns the disposer the surface's registration owns.
   */
  bind(actions: ViewerActions): () => void {
    this.bound.add(actions)
    return () => { this.bound.delete(actions) }
  }

  /** Report that a read has started. */
  begin(): void { for (const actions of this.bound) actions.begin() }

  /**
   * Report the viewer a read returned.
   * @param viewer - who they are and what they may sign in with.
   */
  succeed(viewer: ViewerView): void { for (const actions of this.bound) actions.succeed(viewer) }

  /** Report that a read did not return a viewer. */
  fail(): void { for (const actions of this.bound) actions.fail() }

  /** Drop the previous outcome before another attempt. */
  reset(): void { for (const actions of this.bound) actions.reset() }
}

/**
 * Build the inject factory the screen is registered with.
 *
 * A named function rather than a closure in `apply`, so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param read - the read both surfaces drive.
 * @returns the factory the framework calls with the baked actions.
 */
export function screenFace(
  binding: ViewerBinding,
  read: SharedRead,
): (actions: ViewerActions) => { load: () => Promise<void>; retry: () => Promise<void> } {
  return (actions: ViewerActions) => {
    binding.bind(actions)
    return { load: read.load, retry: read.retry }
  }
}

/**
 * Build the inject factory the row is registered with.
 *
 * The row has no retry of its own: a failure covers the product, and the
 * screen is where somebody tries again.
 * @param binding - the join that will receive the baked actions.
 * @param read - the read both surfaces drive.
 * @returns the factory the framework calls with the baked actions.
 */
export function rowFace(
  binding: ViewerBinding,
  read: SharedRead,
): (actions: ViewerActions) => { load: () => Promise<void> } {
  return (actions: ViewerActions) => {
    binding.bind(actions)
    return { load: read.load }
  }
}
