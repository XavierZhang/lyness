import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualLynInstallLayout,
  buildDualLynRegistry,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@lyness/lyn': '0.2.0', 'lyn-previous': 'npm:@lyness/lyn@0.1.0' } },
      'node_modules/@lyness/cordis': { version: '4.0.1' },
      'node_modules/@lyness/lyn': {
        version: '0.2.0',
        dependencies: { '@lyness/child': '^0.2.0' },
        peerDependencies: { '@lyness/cordis': '^4.0.1' },
      },
      'node_modules/@lyness/child': {
        version: '0.2.0',
        dependencies: { '@lyness/leaf': '^0.2.0' },
      },
      'node_modules/@lyness/leaf': { version: '0.2.0' },
      'node_modules/lyn-previous': {
        name: '@lyness/lyn',
        version: '0.1.0',
        dependencies: { '@lyness/child': '^0.1.0' },
        peerDependencies: { '@lyness/cordis': '^4.0.1' },
      },
      'node_modules/lyn-previous/node_modules/@lyness/child': {
        version: '0.1.0',
        dependencies: { '@lyness/leaf': '^0.1.0' },
      },
      'node_modules/lyn-previous/node_modules/@lyness/leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every LYN package', () => {
    const index: RegistryIndex = new Map([
      ['@lyness/lyn', new Map([['0.1.1-rc.2', {
        name: '@lyness/lyn',
        version: '0.1.1-rc.2',
        dependencies: { '@lyness/child': '^0.1.1-rc.2' },
        peerDependencies: { '@lyness/cordis': '^4.0.1' },
      }]])],
      ['@lyness/child', new Map([['0.1.1-rc.2', {
        name: '@lyness/child',
        version: '0.1.1-rc.2',
      }]])],
      ['@lyness/cordis', new Map([['4.0.1', {
        name: '@lyness/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualLynRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@lyness/lyn')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@lyness/lyn')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@lyness/child': '^0.1.0' },
      peerDependencies: { '@lyness/cordis': '^4.0.1' },
    })
    expect(dual.get('@lyness/lyn')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@lyness/child': '^0.2.0' },
    })
    expect(dual.get('@lyness/cordis')).toBe(index.get('@lyness/cordis'))
  })

  it('accepts isolated LYN releases with one shared Cordis installation', () => {
    expect(assertDualLynInstallLayout(validLayout())).toEqual({
      lynPackagesPerVersion: 3,
      checkedLynEdges: 4,
    })
  })

  it.each([
    ['react', 'node_modules/react'],
    ['react-dom', 'node_modules/react-dom'],
    ['react', 'node_modules/lyn-previous/node_modules/react'],
    ['react-dom', 'node_modules/lyn-previous/node_modules/react-dom'],
  ])('rejects browser runtime %s installed at %s in the LYN-only consumer', (name, path) => {
    const layout = validLayout()
    const packages = { ...layout.packages, [path]: { version: '18.3.1' } }
    expect(() => assertDualLynInstallLayout({ ...layout, packages })).toThrow(
      `${path}: ${name} is a browser build input`,
    )
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/lyn-previous/node_modules/@lyness/leaf')

    expect(() => assertDualLynInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/lyn-previous/node_modules/@lyness/child: dependencies '
      + '@lyness/leaf resolves to node_modules/@lyness/leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/lyn-previous/node_modules/@lyness/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualLynInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @lyness/cordis',
    )
  })
})
