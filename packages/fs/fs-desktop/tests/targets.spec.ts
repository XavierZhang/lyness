/** What the target key carries, and the containment it lets the Host answer without a round-trip. */

import { describe, expect, it } from 'vitest'
import { FsTargetKey } from '@lyness/lyn-fs'
import type { FsTarget } from '@lyness/lyn-fs'
import { containsPath } from '../src/index.ts'
import { decodeTarget, encodeTarget } from '../src/targets.ts'
import type { DesktopTarget } from '../src/protocol.ts'

const RECORD: DesktopTarget = {
  key: 'local-key',
  displayPath: '/home/ada/notes.md',
  processPath: '/home/ada/notes.md',
  fileUrl: 'file:///home/ada/notes.md',
  platform: 'posix',
}

it('carries the desktop record through the target key and back', () => {
  const target = encodeTarget(RECORD)
  expect(target.displayPath).toBe('/home/ada/notes.md')
  expect(decodeTarget(target)).toEqual(RECORD)
})

describe('a target this backend did not resolve', () => {
  it('is refused when its key is not JSON', () => {
    const foreign: FsTarget = { targetKey: FsTargetKey('/home/ada/notes.md'), displayPath: '/home/ada/notes.md' }
    expect(() => decodeTarget(foreign)).toThrow(/was not resolved by the desktop filesystem/)
  })

  it('is refused when its key is JSON of another shape', () => {
    const foreign: FsTarget = { targetKey: FsTargetKey('{"id":7}'), displayPath: 'elsewhere' }
    expect(() => decodeTarget(foreign)).toThrow(/was not resolved by the desktop filesystem/)
  })
})

describe('containment in the desktop\u2019s own path flavour', () => {
  it('holds for a directory and its descendants', () => {
    expect(containsPath('posix', '/home/ada', '/home/ada')).toBe(true)
    expect(containsPath('posix', '/home/ada', '/home/ada/notes.md')).toBe(true)
    expect(containsPath('posix', '/home/ada', '/home/bob/notes.md')).toBe(false)
    expect(containsPath('posix', '/home/ada', '/home/ada-backup')).toBe(false)
  })

  it('holds on a Windows desktop, where the server may be running Linux', () => {
    expect(containsPath('win32', 'C:\\Users\\Ada', 'C:\\Users\\Ada\\notes.md')).toBe(true)
    expect(containsPath('win32', 'C:\\Users\\Ada', 'C:\\Users\\Bob')).toBe(false)
    expect(containsPath('win32', 'C:\\Users\\Ada', 'D:\\notes.md')).toBe(false)
  })
})
