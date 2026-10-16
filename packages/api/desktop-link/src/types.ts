/**
 * The vocabulary one desktop link carries.
 *
 * It is deliberately capability-agnostic. A link is one channel per person,
 * and every capability that needs the person's own machine rides it, so the
 * payload belongs to the capability's own provider rather than to the link:
 * adding `subprocess` must not mean changing the channel.
 *
 * @module @lyness/lyn-desktop-link/types
 */

import type { Branded } from '@lyness/lyn-brand'
import type { JsonValue } from '@lyness/lyn-util-values'

/** Correlates one call with the replies that answer it, within one link. */
export type CallId = Branded<'DesktopCallId'>

/** What the Host asks a desktop to do, or stop doing. */
export type DesktopRequest =
  | {
    /** Start this call. */
    readonly kind: 'call'
    /** Correlates the replies. */
    readonly id: CallId
    /** The capability this call belongs to, such as `subprocess`. */
    readonly capability: string
    /** The operation within that capability, such as `spawn`. */
    readonly operation: string
    /**
     * The operation's arguments, encoded by the capability's own provider.
     *
     * A JSON value rather than `unknown`: this is a wire type, and a codec
     * that cannot describe what crosses it cannot validate it either.
     */
    readonly payload: JsonValue
  }
  | {
    /** Stop a call already sent; the desktop answers with a terminal reply. */
    readonly kind: 'cancel'
    /** The call to stop. */
    readonly id: CallId
  }

/** What a desktop sends back, as it goes and at the end. */
export type DesktopReply =
  | {
    /** One item of a call that produces several, such as a chunk of output. */
    readonly kind: 'item'
    /** The call this answers. */
    readonly id: CallId
    /** The item, encoded by the capability's own provider. */
    readonly value: JsonValue
  }
  | {
    /** The call finished. */
    readonly kind: 'done'
    /** The call this answers. */
    readonly id: CallId
    /** The final value, encoded by the capability's own provider. */
    readonly value: JsonValue
  }
  | {
    /** The call failed on the desktop. */
    readonly kind: 'failed'
    /** The call this answers. */
    readonly id: CallId
    /** What went wrong, in words the Host can put in front of a person. */
    readonly reason: string
  }

/** Why a call did not reach a desktop, or did not finish there. */
export type DesktopRefusal =
  /** That person has no desktop connected. */
  | 'no-desktop'
  /** The desktop disconnected while the call was in flight. */
  | 'desktop-lost'
  /** The desktop answered that the call failed. */
  | 'call-failed'
