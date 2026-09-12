import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('LYNESS_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('LYNESS_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@lyness/lyn', packed('@lyness/lyn', {
        dependencies: { '@lyness/lyn-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@lyness/platform-package': '1.0.0', '@lyness/missing-platform': '1.0.0' },
      })],
      ['@lyness/lyn-desktop-host', packed('@lyness/lyn-desktop-host', {
        dependencies: { '@lyness/lyn': '^1.0.0' },
      })],
      ['@lyness/lyn-base', packed('@lyness/lyn-base', {
        peerDependencies: { '@lyness/cordis': '^1.0.0' },
      })],
      ['@lyness/cordis', packed('@lyness/cordis')],
      ['@lyness/platform-package', packed('@lyness/platform-package')],
      ['@lyness/unused', packed('@lyness/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@lyness/cordis',
      '@lyness/lyn',
      '@lyness/lyn-base',
      '@lyness/lyn-desktop-host',
      '@lyness/platform-package',
    ])
  })

  it('rejects a required internal package absent from the packed release inputs', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@lyness/lyn', packed('@lyness/lyn', {
        dependencies: { '@lyness/lyn-base': '^1.0.0' },
      })],
      ['@lyness/lyn-desktop-host', packed('@lyness/lyn-desktop-host', {
        dependencies: { '@lyness/lyn': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked internal package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@lyness/lyn', packed('@lyness/lyn')],
    ]))).toThrow(/omit @lyness\/lyn-desktop-host/u)
  })

  it('requires the Desktop Host entry and its packaged overlay', () => {
    const files = [
      'package/lib/index.js',
      'package/config/desktop.cordis.patch.yml',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(0, 1))
    }).toThrow(/desktop\.cordis\.patch\.yml/u)
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
  })
})
