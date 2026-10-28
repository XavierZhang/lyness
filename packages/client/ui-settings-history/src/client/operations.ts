/**
 * The calls the history section makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, and a deployment
 * that keeps no trail told apart from a caller who may not read it and from a
 * read that broke.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-history/client/operations
 */

import type { Context } from '@deepseek-ai/cordis'
import { createSharedRead } from '@deepseek-ai/dsh-client-store'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-admin-audit-controller/remote'
import type { AuditEntryView, AuditQueryInput } from '@deepseek-ai/dsh-api-admin-audit-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the section performs, bound to one client context. */
export interface HistoryCalls {
  /** The recorded changes the caller may read. */
  read: (query: AuditQueryInput) => Promise<CallOutcome<readonly AuditEntryView[]>>
}

/**
 * The most entries one export writes.
 *
 * A bound rather than a deployment setting: the loop that pages the whole
 * trail has to stop at something it decides itself, and an auditor who hits
 * it is told the file is partial rather than handed a truncated one quietly.
 * Ten thousand entries is a file a spreadsheet and a log pipeline both open.
 */
export const MAX_EXPORT_ENTRIES = 10_000

/** What one export produced. */
export interface ExportOutcome {
  /** How many entries the file holds. */
  readonly count: number
  /** Whether it holds the whole trail, rather than stopping at the bound. */
  readonly complete: boolean
}

/**
 * Hands one finished file to the reader.
 *
 * A seam rather than a direct download, because what "hand it over" means
 * belongs to the surface: the browser saves it, and a test asserts what was
 * written without a document to click in.
 */
export type DeliverFile = (name: string, contents: string) => void

/** Where an outcome is published. */
export interface HistorySink {
  /** A read has started. */
  begin: () => void
  /** A read returned the entries. */
  succeed: (entries: readonly AuditEntryView[]) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A continuation has started. */
  appending: () => void
  /** A continuation returned the next, older entries. */
  appended: (entries: readonly AuditEntryView[]) => void
  /** An export has started. */
  exporting: () => void
  /** An export finished, or did not. */
  exported: (outcome: ExportOutcome | undefined) => void
}

/** What the section's injected face hands over. */
export interface HistoryOperations {
  /** Read the trail, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Read the entries older than one already shown. */
  loadMore: (before: string) => Promise<void>
  /** Page the whole trail and hand it over as one file. */
  exportTrail: () => Promise<void>
}

/**
 * The deployment call, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so it is
 * reachable on its own: a test can drive it against a Remote double without
 * standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the call the section performs.
 */
export function historyCallsOf(ctx: Context): HistoryCalls {
  return { read: query => ctx.remote.audit.read(query) }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that keeps no trail will not grow one, and a
 * caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the section renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'audit/no-standing') return 'forbidden'
  if (error.code === 'audit/not-permitted') return 'forbidden'
  return 'failed'
}

/**
 * The file one export writes.
 *
 * One JSON entry per line, as the namespace answered it. CSV would have to
 * flatten or stringify the changed fields, which is the part an auditor came
 * for; a line-delimited stream is what a log pipeline reads and what a
 * spreadsheet can still import.
 * @param entries - the entries to write, newest first.
 * @returns the file's contents.
 */
export function trailFile(entries: readonly AuditEntryView[]): string {
  return entries.map(entry => JSON.stringify(entry)).join('\n') + '\n'
}

/**
 * Build the operations.
 * @param calls - performs the Remote call.
 * @param sink - where each outcome is published.
 * @param deliver - hands one finished file to the reader.
 * @returns the operations the section's injected face hands over.
 */
export function createHistoryOperations(
  calls: HistoryCalls,
  sink: HistorySink,
  deliver: DeliverFile,
): HistoryOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      // No organization: the surface reads the one the caller's standing
      // administers, which the namespace resolves rather than the form.
      const read = await calls.read({})
      if (!read.ok) { sink.fail(statusOf(read.error)); return }
      sink.succeed(read.value)
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  return {
    load: shared.load,
    retry: shared.retry,
    loadMore: async (before): Promise<void> => {
      sink.appending()
      try {
        const read = await calls.read({ before })
        // A continuation that failed leaves the page as it is: the entries
        // already shown are still true, and a reader can ask again.
        sink.appended(read.ok ? read.value : [])
      } catch {
        sink.appended([])
      }
    },
    exportTrail: async (): Promise<void> => {
      sink.exporting()
      const collected: AuditEntryView[] = []
      try {
        let before: string | undefined
        for (;;) {
          const read = await calls.read(before === undefined ? {} : { before })
          // A refused page stops the export rather than writing a file that
          // claims to be the trail and is not.
          if (!read.ok) { sink.exported(undefined); return }
          if (read.value.length === 0) break
          collected.push(...read.value)
          before = read.value[read.value.length - 1]?.id
          if (collected.length >= MAX_EXPORT_ENTRIES) break
        }
      } catch {
        sink.exported(undefined)
        return
      }
      const complete = collected.length < MAX_EXPORT_ENTRIES
      const written = complete ? collected : collected.slice(0, MAX_EXPORT_ENTRIES)
      deliver(EXPORT_FILE_NAME, trailFile(written))
      sink.exported({ count: written.length, complete })
    },
  }
}

/** The name the exported file is offered under. */
export const EXPORT_FILE_NAME = 'administrative-history.jsonl'
