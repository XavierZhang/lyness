/**
 * What the section's calls do with what the deployment answers: one read
 * shared by every caller, a deployment that maintains no bots told apart from
 * a caller who may not and from a read that broke, and a refusal carrying the
 * fields a form marks.
 */

import { describe, expect, it, vi } from 'vitest'
import type { BotRowView, PresetOptionView, TeamRowView } from '@deepseek-ai/dsh-api-bots-controller/types'
import { createBotsOperations, statusOf } from '../src/client/operations.ts'
import type { BotsCalls, BotsSink, CallOutcome } from '../src/client/operations.ts'

const BOT: BotRowView = {
  id: 'triage',
  displayName: 'Triage',
  organization: 'acme',
  persona: 'You answer in short sentences.',
  job: 'Reads incoming reports and files them.',
  preset: 'standard',
  written: false,
  available: true,
}

const PRESET: PresetOptionView = { id: 'standard', displayName: 'Standard' }

const TEAM: TeamRowView = {
  id: 'intake',
  displayName: 'Intake',
  organization: 'acme',
  members: ['triage'],
  written: false,
}


/** One refusal, as a Remote call answers it. */
function refused(code: string, details: object = {}, message?: string): CallOutcome<never> {
  return {
    ok: false,
    error: { code, message: message ?? code, details } as never,
  }
}

/** A sink that records what it was told. */
function recorder(): BotsSink & { seen: string[]; read: unknown[] } {
  const seen: string[] = []
  const read: unknown[] = []
  return {
    seen,
    read,
    begin: () => { seen.push('begin') },
    succeed: (value) => { seen.push('succeed'); read.push(value) },
    fail: (status) => { seen.push(`fail:${status}`) },
    reset: () => { seen.push('reset') },
    work: () => { seen.push('work') },
    saved: (bot) => { seen.push(`saved:${bot.id}`) },
    removed: (id) => { seen.push(`removed:${id}`) },
    teamSaved: (team) => { seen.push(`team-saved:${team.id}`) },
    teamRemoved: (id) => { seen.push(`team-removed:${id}`) },
    refused: (refusal) => { seen.push(`refused:${refusal.reason}:${refusal.fields.join(',')}`) },
  }
}

/** Calls answering whatever one test needs. */
function calls(over: Partial<BotsCalls> = {}): BotsCalls {
  return {
    list: () => Promise.resolve({ ok: true, value: [BOT] }),
    presets: () => Promise.resolve({ ok: true, value: [PRESET] }),
    save: () => Promise.resolve({ ok: true, value: BOT }),
    remove: () => Promise.resolve({ ok: true, value: undefined }),
    teams: () => Promise.resolve({ ok: true, value: [TEAM] }),
    saveTeam: () => Promise.resolve({ ok: true, value: TEAM }),
    removeTeam: () => Promise.resolve({ ok: true, value: undefined }),
    ...over,
  }
}

describe('the read', () => {
  it('answers the bots and the presets one may be given', async () => {
    const sink = recorder()
    await createBotsOperations(calls(), sink).load()
    expect(sink.seen).toEqual(['begin', 'succeed'])
    expect(sink.read).toEqual([{ bots: [BOT], presets: [PRESET], teams: [TEAM] }])
  })

  it('is shared: opening the section twice asks the deployment once', async () => {
    const list = vi.fn(() => Promise.resolve<CallOutcome<readonly BotRowView[]>>({ ok: true, value: [BOT] }))
    const operations = createBotsOperations(calls({ list }), recorder())
    await Promise.all([operations.load(), operations.load()])
    expect(list).toHaveBeenCalledOnce()
  })

  it('tells a deployment with no bots apart from a caller who may not read them', async () => {
    const none = recorder()
    await createBotsOperations(calls({ list: () => Promise.resolve(refused('gateway/internal')) }), none).load()
    expect(none.seen).toEqual(['begin', 'fail:unavailable'])

    const forbidden = recorder()
    await createBotsOperations(calls({ list: () => Promise.resolve(refused('bots/no-standing')) }), forbidden).load()
    expect(forbidden.seen).toEqual(['begin', 'fail:forbidden'])
  })

  it('reports a read that broke as retryable, whichever third broke', async () => {
    const bots = recorder()
    await createBotsOperations(calls({ list: () => Promise.resolve(refused('gateway/timeout')) }), bots).load()
    expect(bots.seen).toEqual(['begin', 'fail:failed'])

    const presets = recorder()
    await createBotsOperations(calls({ presets: () => Promise.resolve(refused('gateway/timeout')) }), presets).load()
    expect(presets.seen).toEqual(['begin', 'fail:failed'])

    const teams = recorder()
    await createBotsOperations(calls({ teams: () => Promise.resolve(refused('gateway/timeout')) }), teams).load()
    expect(teams.seen).toEqual(['begin', 'fail:failed'])

    const thrown = recorder()
    await createBotsOperations(calls({ list: () => Promise.reject(new Error('carrier')) }), thrown).load()
    expect(thrown.seen).toEqual(['begin', 'fail:failed'])
  })

  it('drops the previous failure before a retry', async () => {
    const sink = recorder()
    const operations = createBotsOperations(calls({ list: () => Promise.resolve(refused('gateway/timeout')) }), sink)
    await operations.load()
    await operations.retry()
    expect(sink.seen).toEqual(['begin', 'fail:failed', 'reset', 'begin', 'fail:failed'])
  })
})

describe('a change', () => {
  it('publishes what the bot now reads as, and what was removed', async () => {
    const saved = recorder()
    await createBotsOperations(calls(), saved)
      .save({ displayName: 'Triage', organization: 'acme', persona: '', job: '', preset: 'standard' })
    expect(saved.seen).toEqual(['work', 'saved:triage'])

    const removed = recorder()
    await createBotsOperations(calls(), removed).remove('triage')
    expect(removed.seen).toEqual(['work', 'removed:triage'])
  })

  it('carries the fields the server named, and marks none on a refusal about something else', async () => {
    const incomplete = recorder()
    await createBotsOperations(
      calls({ save: () => Promise.resolve(refused('bots/incomplete', { fields: ['organization'] }, 'needs one')) }),
      incomplete,
    ).save({ displayName: 'Triage', organization: '', persona: '', job: '', preset: 'standard' })
    expect(incomplete.seen).toEqual(['work', 'refused:needs one:organization'])

    const written = recorder()
    await createBotsOperations(
      calls({ remove: () => Promise.resolve(refused('bots/written', {}, 'configuration owns it')) }),
      written,
    ).remove('scribe')
    expect(written.seen).toEqual(['work', 'refused:configuration owns it:'])
  })

  it('reports what the carrier rejected with when it was not a refusal', async () => {
    const saving = recorder()
    await createBotsOperations(calls({ save: () => Promise.reject(new Error('socket closed')) }), saving)
      .save({ displayName: 'Triage', organization: 'acme', persona: '', job: '', preset: 'standard' })
    expect(saving.seen).toEqual(['work', 'refused:socket closed:'])

    const removing = recorder()
    await createBotsOperations(calls({ remove: () => Promise.reject(new Error('socket closed')) }), removing)
      .remove('triage')
    expect(removing.seen).toEqual(['work', 'refused:socket closed:'])
  })
})

describe('a team change', () => {
  it('publishes what the team now reads as, and what was removed', async () => {
    const saved = recorder()
    await createBotsOperations(calls(), saved)
      .saveTeam({ displayName: 'Intake', organization: 'acme', members: ['triage'] })
    expect(saved.seen).toEqual(['work', 'team-saved:intake'])

    const removed = recorder()
    await createBotsOperations(calls(), removed).removeTeam('intake')
    expect(removed.seen).toEqual(['work', 'team-removed:intake'])
  })

  it('reports a refusal with the fields the server named, and a carrier that did not deliver', async () => {
    const incomplete = recorder()
    await createBotsOperations(
      calls({ saveTeam: () => Promise.resolve(refused('bots/incomplete', { fields: ['organization'] }, 'needs one')) }),
      incomplete,
    ).saveTeam({ displayName: 'Intake', organization: '', members: [] })
    expect(incomplete.seen).toEqual(['work', 'refused:needs one:organization'])

    const unknown = recorder()
    await createBotsOperations(
      calls({ saveTeam: () => Promise.resolve(refused('bots/unknown-bot', {}, 'not ours')) }),
      unknown,
    ).saveTeam({ displayName: 'Intake', organization: 'acme', members: ['theirs'] })
    expect(unknown.seen).toEqual(['work', 'refused:not ours:'])

    const thrown = recorder()
    await createBotsOperations(calls({ saveTeam: () => Promise.reject(new Error('socket closed')) }), thrown)
      .saveTeam({ displayName: 'Intake', organization: 'acme', members: [] })
    expect(thrown.seen).toEqual(['work', 'refused:socket closed:'])

    const removing = recorder()
    await createBotsOperations(calls({ removeTeam: () => Promise.reject(new Error('socket closed')) }), removing)
      .removeTeam('intake')
    expect(removing.seen).toEqual(['work', 'refused:socket closed:'])

    const written = recorder()
    await createBotsOperations(
      calls({ removeTeam: () => Promise.resolve(refused('bots/written', {}, 'configuration owns it')) }),
      written,
    ).removeTeam('intake')
    expect(written.seen).toEqual(['work', 'refused:configuration owns it:'])
  })
})

describe('what one answer says about itself', () => {
  it('names the three read states a section renders', () => {
    expect(statusOf({ code: 'gateway/internal' } as never)).toBe('unavailable')
    expect(statusOf({ code: 'gateway/forbidden' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'bots/no-standing' } as never)).toBe('forbidden')
    expect(statusOf({ code: 'gateway/timeout' } as never)).toBe('failed')
  })
})
