/**
 * The calls the capabilities section makes, and the sharing around them.
 *
 * Their own unit because the behaviour worth pinning is the join: two
 * namespaces answer one page, and the model catalog is allowed to fail on its
 * own without taking the rest of the page down — a deployment whose provider
 * list is broken still has tools and skills worth reading.
 *
 * @module @lyness/lyn-client-ui-settings-capabilities/client/operations
 */

import type { Context } from '@lyness/cordis'
import { createSharedRead } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-agent-capabilities-controller/remote'
import type { AgentCapabilitiesView } from '@lyness/lyn-api-agent-capabilities-controller/types'
import type { ModelCatalog } from '@lyness/lyn-api-session-controller/types'
import type { CapabilitiesRead } from './store.ts'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The two calls the section performs, bound to one client context. */
export interface CapabilitiesCalls {
  /** Tools, connections and skills, each naming who gave it. */
  capabilities: () => Promise<CallOutcome<AgentCapabilitiesView>>
  /** The models this deployment routes. */
  models: () => Promise<CallOutcome<ModelCatalog>>
}

/** Where an outcome is published. */
export interface CapabilitiesSink {
  /** A read has started. */
  begin: () => void
  /** A read answered. */
  succeed: (read: CapabilitiesRead) => void
  /** A read did not answer. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
}

/** What the section's injected face hands over. */
export interface CapabilitiesOperations {
  /** Read both answers, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
}

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the calls the section performs.
 */
export function capabilitiesCallsOf(ctx: Context): CapabilitiesCalls {
  return {
    capabilities: () => ctx.remote.agentCapabilities.describe(),
    models: () => ctx.remote.session.modelCatalog(),
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createCapabilitiesOperations(
  calls: CapabilitiesCalls,
  sink: CapabilitiesSink,
): CapabilitiesOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const [capabilities, models] = await Promise.all([calls.capabilities(), calls.models()])
      // Only the capability read decides whether the page has an answer; a
      // broken provider list leaves the models out and the rest intact.
      if (!capabilities.ok) { sink.fail(); return }
      sink.succeed({ capabilities: capabilities.value, models: models.ok ? models.value : undefined })
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail()
    }
  }, () => { sink.reset() })
  return { load: shared.load, retry: shared.retry }
}
