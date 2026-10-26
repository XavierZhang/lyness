// @vitest-environment jsdom

/**
 * How one finished export reaches the reader: an object URL the browser saves
 * under the offered name, released once the click has been handled.
 */

import { afterEach, expect, it, vi } from 'vitest'
import { deliverDownload } from '../src/client/index.ts'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('offers the file to the browser and releases the object URL after the click', () => {
  vi.useFakeTimers()
  const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:history')
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  const clicked: { download: string; href: string }[] = []
  const anchor = document.createElement('a')
  vi.spyOn(anchor, 'click').mockImplementation(() => {
    clicked.push({ download: anchor.download, href: anchor.href })
  })
  vi.spyOn(document, 'createElement').mockReturnValue(anchor)

  deliverDownload('administrative-history.jsonl', '{"id":"one"}\n')

  expect(created).toHaveBeenCalledOnce()
  expect(created.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
  expect((created.mock.calls[0]?.[0] as Blob).type).toBe('application/x-ndjson')
  expect(clicked).toEqual([{ download: 'administrative-history.jsonl', href: 'blob:history' }])
  // Released on the next tick: a click that has not been handled yet still
  // needs the object alive.
  expect(revoked).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(revoked).toHaveBeenCalledWith('blob:history')
})
