/**
 * Behavior guard for the shipped telemetry rows: under the default
 * environment, the only thing that authorizes a session upload — explicit
 * feedback — still produces no outbound request.
 *
 * `base.spec.ts` pins the two config values this fork overrides. That check
 * fails only if an upstream sync edits those exact expressions; it says
 * nothing if upstream moves the capture to a different row, a different
 * variable, or a second exporter. This spec asserts the outcome instead, so a
 * relocated default is caught by the absence of traffic rather than by the
 * presence of a known string.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@lyness/cordis-plugin-include'
import { interpolate } from '@lyness/cordis-plugin-loader/src/config/utils.ts'
import { Context } from '@lyness/cordis'
import OTel from '@lyness/lyn-otel'
import { recordFeedback } from '@lyness/lyn-command-feedback'
import { createUserMessage } from '@lyness/lyn-llm'
import MessageFeedbackService from '@lyness/lyn-message-feedback'
import SessionStore from '@lyness/lyn-session'
import OpenTelemetrySessionBackend, { type Config, SessionTelemetryMode } from '@lyness/lyn-session-telemetry-otel'

/** The telemetry variables an operator sets to opt a deployment in. */
const OPT_IN_VARIABLES = [
  'LYNESS_TELEMETRY_MODE',
  'LYNESS_TELEMETRY_OTLP_URL',
  'LYNESS_TELEMETRY_DISABLED',
  'LYNESS_PRODUCT_ANALYTICS_OTLP_URL',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
] as const

const root = fileURLToPath(new URL('..', import.meta.url))

/** One shipped patch row, with its `!!js` expressions still unevaluated. */
interface Row {
  id?: string
  disabled?: boolean | { __jsExpr: string }
  config?: Record<string, unknown>
}

/** Every row the shipped base patch inserts. */
function shippedRows(): Row[] {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    lyn?: { bundle?: { patch?: string } }
  }
  const patch = manifest.lyn?.bundle?.patch
  if (patch === undefined) throw new Error('lyn-base declares no lyn.bundle.patch')
  const parsed = yaml.load(readFileSync(resolve(root, patch), 'utf8'), { schema: entryListSchema })
  return (parsed as { insert?: Row[] }[]).flatMap(entry => entry.insert ?? [])
}

/**
 * Evaluate the `!!js` expressions a row's config carries, through the same
 * helper the Loader uses, so the test runs the shipped values rather than a
 * transcription of them.
 * @param value - one config value, possibly a recorded expression.
 * @returns the value the Loader would hand the plugin.
 */
function resolved(value: unknown): unknown {
  return interpolate({ process }, value)
}

const servers: Server[] = []
let tempHome: string
let previousHome: string | undefined
const previousOptIns = new Map<string, string | undefined>()

beforeAll(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'lyn-telemetry-silence-'))
  previousHome = process.env.LYNESS_HOME
  process.env.LYNESS_HOME = tempHome
  // The default environment is the one a deployment gets with nothing set; an
  // ambient opt-in on the developer's machine must not weaken the assertion.
  for (const name of OPT_IN_VARIABLES) {
    previousOptIns.set(name, process.env[name])
    Reflect.deleteProperty(process.env, name)
  }
})

afterAll(() => {
  if (previousHome === undefined) delete process.env.LYNESS_HOME
  else process.env.LYNESS_HOME = previousHome
  for (const [name, value] of previousOptIns) {
    if (value === undefined) Reflect.deleteProperty(process.env, name)
    else process.env[name] = value
  }
  rmSync(tempHome, { recursive: true, force: true })
})

afterEach(async () => {
  for (const server of servers.splice(0)) {
    const closed = once(server, 'close')
    server.close()
    server.closeAllConnections()
    await closed
  }
})

/** A collector that records every request it is given. */
async function collector(): Promise<{ requests: string[]; url: string }> {
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(`${request.method ?? ''} ${request.url ?? ''}`)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('collector did not bind a port')
  return { requests, url: `http://127.0.0.1:${String(address.port)}/v1/logs` }
}

describe('shipped telemetry rows under the default environment', () => {
  it('uploads nothing when a person gives feedback', async () => {
    const row = shippedRows().find(entry => entry.id === 'session-telemetry-otel')
    expect(row, 'the shipped base patch no longer carries a session-telemetry-otel row').toBeDefined()
    const config = resolved(row?.config ?? {}) as Config

    // Point the SDK's own fallback at a collector this test owns: if the
    // shipped config left capture on, its export lands here and is counted.
    const listener = await collector()
    process.env['OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'] = listener.url

    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(OTel)
    await ctx.plugin(MessageFeedbackService, { maxNoteBytes: 4096 })
    await ctx.plugin(OpenTelemetrySessionBackend, config).await()

    const session = ctx.sessions.create()
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'a question' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    // Feedback is the one act that authorizes release; everything else in a
    // session never reaches the exporter at all.
    recordFeedback(session, { text: 'not useful', category: 'task-result' })
    await ctx.fiber.dispose()

    Reflect.deleteProperty(process.env, 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT')
    expect(listener.requests).toEqual([])
  })

  it('does upload once an operator opts in, so the silence above is the config and not the harness', async () => {
    // The positive control. Without it the assertion above would also pass
    // against a backend that never exports at all, and the guard would prove
    // nothing about the shipped values.
    const listener = await collector()
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(OTel)
    await ctx.plugin(MessageFeedbackService, { maxNoteBytes: 4096 })
    await ctx.plugin(OpenTelemetrySessionBackend, {
      mode: SessionTelemetryMode.FEEDBACK_ONLY,
      exporter: { url: listener.url, timeoutMillis: 1000 },
      shutdownTimeoutMillis: 3000,
    }).await()

    const session = ctx.sessions.create()
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'a question' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    recordFeedback(session, { text: 'not useful', category: 'task-result' })
    await ctx.fiber.dispose()

    expect(listener.requests.length).toBeGreaterThan(0)
  })

  it('ships no endpoint for the desktop product-analytics row', () => {
    // The desktop row's endpoint comes only from the operator's variable. An
    // upstream sync that reinstates a vendor default fails here.
    const patch = resolve(root, '..', 'web-app', 'cordis.patch.yml')
    const parsed = yaml.load(readFileSync(patch, 'utf8'), { schema: entryListSchema })
    const rows = (parsed as { insert?: Row[] }[]).flatMap(entry => entry.insert ?? [])
    const telemetry = rows.find(entry => entry.id === 'desktop-product-telemetry')
    expect(telemetry, 'the Web bundle no longer carries a desktop-product-telemetry row').toBeDefined()
    expect(resolved(telemetry?.config?.['endpoint'])).toBeUndefined()
  })
})
