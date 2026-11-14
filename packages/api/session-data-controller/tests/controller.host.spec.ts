/**
 * What the namespace answers: a deletion the caller may make, a conversation
 * that is somebody else's answered exactly as one that is not there, and an
 * open conversation refused with the code that tells a reader what to do.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { SESSION_FORMAT_VERSION, SessionId } from '@lyness/lyn-session'
import type { SessionHeader } from '@lyness/lyn-session'
import { SessionDeletionLiveError } from '@lyness/lyn-session-deletion'
import { SessionAlreadyOwnedError, SessionPersistenceNotFoundError } from '@lyness/lyn-session-persistence'
import { SessionQueryError } from '@lyness/lyn-session-query'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import SessionDataController from '../src/index.ts'

const CONVERSATION = SessionId('mine')

const header: SessionHeader = {
  version: SESSION_FORMAT_VERSION,
  id: CONVERSATION,
  createdAt: 1,
  isSeeded: false,
}

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

interface HarnessOptions {
  /** What the ownership rule answers, or no rule at all. */
  visible?: boolean
  /** The conversation the query service knows; omitted means it knows none. */
  stored?: boolean
  /** What the deletion throws instead of succeeding. */
  refuse?: unknown
}

/**
 * Mount the controller over doubles for the rule and the deletion.
 *
 * Doubles rather than the real stack because what this unit owns is the
 * authorization and the wire vocabulary; `lyn-session-deletion` has its own
 * spec over the shipped backends.
 * @param options - what the rule answers and what the deletion does.
 * @returns the controller and the conversations it was asked to delete.
 */
async function harness(options: HarnessOptions = {}) {
  const ctx = new Context()
  live.push(ctx)
  const asked: string[] = []
  ctx.provide('sessionQuery', {
    observeSession: (id: SessionId) => {
      if (options.stored === false) {
        return Promise.reject(new SessionQueryError(`session "${id}" not found`, 'SESSION_QUERY_SESSION_NOT_FOUND'))
      }
      return Promise.resolve({ header, events: [], [Symbol.dispose]: () => {} })
    },
  })
  if (options.visible !== undefined) {
    ctx.provide('sessionVisibility', { mayReadObservation: () => Promise.resolve(options.visible ?? false) })
  }
  ctx.provide('sessionDeletion', {
    delete: async (id: SessionId) => {
      asked.push(String(id))
      if (options.refuse !== undefined) throw options.refuse
      return { removed: [SessionId('child'), id], forgotten: [id] }
    },
  })
  await ctx.plugin(SessionDataController)
  return { controller: ctx.sessionDataController, asked }
}

describe('sessionData.delete', () => {
  it('answers every stored session that went', async () => {
    const { controller, asked } = await harness({ visible: true })
    expect(await controller.delete('mine')).toEqual({ removed: ['child', 'mine'] })
    expect(asked).toEqual(['mine'])
  })

  it('deletes for a deployment that mounts no ownership rule', async () => {
    // The single-operator shape: there is nobody else for the answer to be about.
    const { controller, asked } = await harness()
    expect(await controller.delete('mine')).toEqual({ removed: ['child', 'mine'] })
    expect(asked).toEqual(['mine'])
  })

  it('answers another person\'s conversation exactly as one that never existed', async () => {
    const other = await harness({ visible: false })
    const absent = await harness({ visible: true, stored: false })
    for (const { controller, asked } of [other, absent]) {
      await expect(controller.delete('mine')).rejects.toMatchObject({ code: 'session-data/not-found' })
      // Nothing is asked for: a refusal that deleted first would be no refusal.
      expect(asked).toEqual([])
    }
  })

  it('refuses an open conversation with the code that says to close it', async () => {
    const { controller } = await harness({
      visible: true,
      refuse: new SessionDeletionLiveError(CONVERSATION, CONVERSATION),
    })
    await expect(controller.delete('mine')).rejects.toMatchObject({ code: 'session-data/open' })
  })

  it('refuses a conversation another process writes with the same code', async () => {
    const { controller } = await harness({ visible: true, refuse: new SessionAlreadyOwnedError(CONVERSATION) })
    await expect(controller.delete('mine')).rejects.toMatchObject({ code: 'session-data/open' })
  })

  it('answers not-found when the log went between the two steps', async () => {
    const { controller } = await harness({ visible: true, refuse: new SessionPersistenceNotFoundError(CONVERSATION) })
    await expect(controller.delete('mine')).rejects.toMatchObject({ code: 'session-data/not-found' })
  })

  it('lets an unrelated failure through rather than dressing it as a refusal', async () => {
    const broken: unknown = new Error('the disk is on fire')
    const { controller } = await harness({ visible: true, refuse: broken })
    await expect(controller.delete('mine')).rejects.toThrow(broken)
  })

  it('lets a query failure that is not an absence through', async () => {
    const ctx = new Context()
    live.push(ctx)
    const broken = new SessionQueryError('the index is unreadable', 'SESSION_QUERY_PERSISTENCE_FAILED')
    ctx.provide('sessionQuery', { observeSession: () => Promise.reject(broken) })
    ctx.provide('sessionVisibility', { mayReadObservation: () => Promise.resolve(true) })
    ctx.provide('sessionDeletion', { delete: () => Promise.resolve({ removed: [], forgotten: [] }) })
    await ctx.plugin(SessionDataController)
    await expect(ctx.sessionDataController.delete('mine')).rejects.toThrow(broken)
    expect(broken).toBeInstanceOf(SessionQueryError)
  })

  it('declares the member standing and the namespace it owns', async () => {
    const { controller } = await harness({ visible: true })
    expect(controller).toBeInstanceOf(SessionDataController)
    // The refusal vocabulary is the namespace's own, so a client renders a
    // reason rather than a transport fault.
    expect(new RemoteError('session-data/open', 'still open', {}).code).toBe('session-data/open')
  })
})
