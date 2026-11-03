/**
 * The client service that owns who the viewer is.
 *
 * One read answers it, and more than one surface needs the answer: the row
 * naming whose session this is, the screen that covers a deployment with
 * accounts and nobody in one, and the Settings navigation deciding which
 * planes to offer. Each asking for itself would ask the deployment once per
 * surface and could show two of them disagreeing, so the read, its outcome,
 * and the derived plane all live here.
 *
 * @module @lyness/lyn-client-ui-viewer/client/viewer
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import { createOutcomeRead, createSnapshotStore } from '@lyness/lyn-client-store'
import type { ReadOutcome, SharedRead, SnapshotStore } from '@lyness/lyn-client-store'
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'
import { administers } from './plane.ts'

declare module '@lyness/cordis' {
  interface Context {
    uiViewer: UiViewer
  }
}

/** What a surface reading this service renders. */
export interface ViewerSnapshot {
  /** Where the read stands. */
  status: 'idle' | 'loading' | 'ready' | 'failed'
  /** Who the viewer is; absent until a read succeeds. */
  viewer: ViewerView | undefined
  /**
   * Whether the administration plane belongs to this viewer, derived from the
   * same answer rather than re-decided per surface.
   */
  administers: boolean
}

/** The one Remote read this service performs. */
export type ViewerRead = () => Promise<ReadOutcome<ViewerView>>

/**
 * Shared viewer state for every surface that renders who the viewer is.
 *
 * Reads are lazy and shared: the first surface to mount drives one call, and
 * surfaces mounting while it is in flight join it. A failed read keeps no
 * message, because the reason belongs to the transport and a surface can only
 * retry.
 */
export class UiViewer extends Service {
  /** Snapshot source a slot registration hands to its `hooks` compartment. */
  readonly state: SnapshotStore<ViewerSnapshot>
  private readonly shared: SharedRead

  /**
   * @param ctx - the providing plugin's context.
   * @param read - performs one viewer read; the plugin binds it to its own
   * Remote so a test can drive the service without a transport.
   */
  constructor(ctx: Context, read: ViewerRead) {
    super(ctx, 'uiViewer')
    this.state = createSnapshotStore<ViewerSnapshot>({ status: 'idle', viewer: undefined, administers: false })
    this.shared = createOutcomeRead(read, {
      begin: () => { this.state.update((draft) => { draft.status = 'loading' }) },
      succeed: (viewer) => { this.state.set({ status: 'ready', viewer, administers: administers(viewer) }) },
      // The reason is the transport's and a viewer can only retry, so no
      // message is kept; the previous answer is dropped with it, because a
      // plane shown from a stale read is a plane nothing currently supports.
      fail: () => { this.state.set({ status: 'failed', viewer: undefined, administers: false }) },
      reset: () => { this.state.set({ status: 'idle', viewer: undefined, administers: false }) },
    })
  }

  /**
   * Read the viewer, or join the read already running.
   * @returns when this call's read has settled.
   */
  load(): Promise<void> {
    return this.shared.load()
  }

  /**
   * Drop the previous outcome and read again.
   * @returns when the new read has settled.
   */
  retry(): Promise<void> {
    return this.shared.retry()
  }
}
