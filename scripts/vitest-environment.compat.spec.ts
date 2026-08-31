// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

describe('Vitest jsdom compatibility', () => {
  it('provides isolated browser storage instead of Node process storage', () => {
    if (process.allowedNodeEnvironmentFlags.has('--webstorage')) {
      expect(process.execArgv.filter(argument => argument === '--no-webstorage')).toHaveLength(1)
    }
    localStorage.setItem('lyn-vitest-storage-probe', 'available')

    expect(localStorage.getItem('lyn-vitest-storage-probe')).toBe('available')
    localStorage.removeItem('lyn-vitest-storage-probe')
  })
})
