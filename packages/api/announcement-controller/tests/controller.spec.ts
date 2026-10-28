/** The Remote read hands back the source's own list, unchanged and unsorted here. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import type { Announcement } from '../src/types.ts'
import AnnouncementController from '../src/index.ts'

const roots: Context[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose())) })

const RELEASE: Announcement = {
  id: 'v0-1-7',
  version: '0.1.7',
  publishedAt: '2026-10-15T08:00:00.000Z',
  title: '0.1.7',
  body: '- Administrators can grant credits',
}

const NOTICE: Announcement = {
  id: 'maintenance',
  publishedAt: '2026-10-20T16:00:00.000Z',
  title: 'Maintenance',
  body: 'About 30 minutes from 02:00.',
}

function fixture(published: readonly Announcement[]) {
  const ctx = new Context()
  roots.push(ctx)
  const source = { published: vi.fn().mockResolvedValue(published) }
  ctx.provide('announcements', source as never)
  return { ctx, source, controller: new AnnouncementController(ctx) }
}

it('hands back the source list as it came, in its order', async () => {
  const { source, controller } = fixture([NOTICE, RELEASE])
  expect(await controller.published()).toEqual([NOTICE, RELEASE])
  expect(source.published).toHaveBeenCalledOnce()
})

it('answers an empty list for a deployment with nothing to say', async () => {
  const { controller } = fixture([])
  expect(await controller.published()).toEqual([])
})

it('asks the source each time rather than holding an answer', async () => {
  const { source, controller } = fixture([RELEASE])
  await controller.published()
  await controller.published()
  expect(source.published).toHaveBeenCalledTimes(2)
})
