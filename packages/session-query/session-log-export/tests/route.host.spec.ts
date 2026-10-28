import { Context } from '@lyness/cordis'
import { HostConnectionService } from '@lyness/lyn-client-connection'
import type { BrowserAuth } from '@lyness/lyn-client-connection/src/browser-auth.ts'
import { SESSION_FORMAT_VERSION } from '@lyness/lyn-session'
import type { SessionHeader, SessionId } from '@lyness/lyn-session'
import type { SessionHandle } from '@lyness/lyn-session-persistence'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { PeerScope } from '@lyness/lyn-typert-protocol'
import {
  Config,
  EXPORT_NOT_FOUND,
  SESSION_LOG_FILENAME,
  SESSION_LOG_EXPORT_PATH,
  apply,
  inject,
} from '../src/index.ts'

/** These assertions are not about access, so every dispatch speaks for the owner. */
const OWNER = { principal: { kind: 'owner' } } as PeerScope

const sid = (value: string): SessionId => value as SessionId

function readHandle(id: string): SessionHandle {
  const header: SessionHeader = {
    version: SESSION_FORMAT_VERSION,
    id: sid(id),
    createdAt: 1,
    isSeeded: false,
    cwd: '/workspace',
    delegationDepth: 0,
  }
  return {
    id: header.id,
    header,
    access: 'read',
    read: async () => ({ eventState: 'detached', events: [] }),
    close: async () => {},
  } as unknown as SessionHandle
}

async function mounted(withServices: boolean, visible?: boolean, observable = true): Promise<{
  readonly connection: HostConnectionService
  readonly dispose: () => Promise<void>
}> {
  const ctx = new Context()
  ctx.provide('commands', { register: () => () => {} } as never)
  // A deployment that serves named people mounts the ownership rule; the
  // route runs inside the same per-request scopes a decoded call does, so
  // the rule answers for whoever is asking.
  if (visible !== undefined) {
    ctx.provide('sessionVisibility', { mayReadObservation: () => Promise.resolve(visible) } as never)
  }
  if (withServices) {
    ctx.provide('sessionQuery', {
      traceSession: async () => ({ descendants: [] }),
      observeSession: (id: SessionId) => observable
        ? Promise.resolve({ header: readHandle(String(id)).header, events: [], [Symbol.dispose]: () => {} })
        : Promise.reject(new Error('no such session')),
    } as never)
    ctx.provide('sessionPersistence', {
      stat: async (id: SessionId) => ({ header: readHandle(String(id)).header }),
      open: async (id: SessionId) => readHandle(String(id)),
    } as never)
    ctx.provide('attachments', {
      readImage: async () => { throw new Error('fixture has no images') },
    } as never)
  }
  const connection = new HostConnectionService(ctx, [], {} as BrowserAuth)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber
  return { connection, dispose: () => fiber.dispose() }
}

describe('Session log export Fetch route', () => {
  it('registers one GET/HEAD route and removes it with the plugin fiber', async () => {
    const { connection, dispose } = await mounted(true)
    const shared = connection.createSharedFetchHandler('/api')

    const response = await shared.fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`,
    ), connection.browserPeer)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
    expect(strFromU8(files[SESSION_LOG_FILENAME] as Uint8Array)).toContain('"id":"session-1"')

    const head = await shared.fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`, { method: 'HEAD' },
    ), connection.browserPeer)
    expect(head.status).toBe(200)
    expect(head.body).toBeNull()

    await dispose()
    expect((await shared.fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`,
    ), connection.browserPeer)).status).toBe(404)
  })

  it('exports a session its asker owns and answers nothing for one they do not', async () => {
    const owned = await mounted(true, true)
    expect((await owned.connection.createSharedFetchHandler('/api').fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`,
    ), OWNER)).status).toBe(200)
    await owned.dispose()

    const theirs = await mounted(true, false)
    const refused = await theirs.connection.createSharedFetchHandler('/api').fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`,
    ), OWNER)
    // The same answer a session that does not exist gets: a distinct refusal
    // would tell one person that another's conversation is there.
    expect(refused.status).toBe(404)
    expect(await refused.text()).toBe(EXPORT_NOT_FOUND)
    await theirs.dispose()
  })

  it('answers nothing for a session the rule cannot even observe', async () => {
    const { connection, dispose } = await mounted(true, true, false)
    const response = await connection.createSharedFetchHandler('/api').fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=gone`,
    ), OWNER)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe(EXPORT_NOT_FOUND)
    await dispose()
  })

  it('validates the query before reporting missing export services', async () => {
    const { connection, dispose } = await mounted(false)
    const shared = connection.createSharedFetchHandler('/api')
    expect((await shared.fetch(new Request(`http://host${SESSION_LOG_EXPORT_PATH}`), connection.browserPeer)).status).toBe(400)
    expect((await shared.fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1&includeDescendants=1`,
    ), connection.browserPeer)).status).toBe(400)
    expect((await shared.fetch(new Request(
      `http://host${SESSION_LOG_EXPORT_PATH}?sessionId=session-1`,
    ), connection.browserPeer)).status).toBe(500)
    await dispose()
  })

  it('validates the compression level', () => {
    expect(Config({})).toEqual({ compressionLevel: 6 })
    expect(Config({ compressionLevel: 0 })).toEqual({ compressionLevel: 0 })
    expect(Config({ compressionLevel: 9 })).toEqual({ compressionLevel: 9 })
    for (const compressionLevel of [-1, 10, 1.5]) {
      expect(() => Config({ compressionLevel } as never)).toThrow()
    }
  })
})
