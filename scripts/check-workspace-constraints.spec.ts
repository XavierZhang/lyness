/** Experimental-package publication and dependency constraints. */

import { describe, expect, it } from 'vitest'
import {
  checkLynFamilyVersion,
  checkExperimentalDependencyIsolation,
  checkExperimentalManifest,
  expectedLynPackageFiles,
  type WorkspaceManifest,
} from './check-workspace-constraints.ts'

const experimental: WorkspaceManifest = {
  dir: 'packages/experimental/prototype',
  manifest: { name: '@lyness/experimental-prototype', private: true },
}

const publicExperimental: WorkspaceManifest = {
  dir: 'packages/experimental/agent-team',
  manifest: {
    name: '@lyness/experimental-agent-team',
    publishConfig: { access: 'public' },
  },
}

describe('experimental workspace constraints', () => {
  it('requires the experimental package-name prefix', () => {
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, name: '@lyness/prototype' },
    })).toEqual([
      '@lyness/prototype: experimental package name must start with "@lyness/experimental-"',
    ])
  })

  it('requires private manifests without publication metadata', () => {
    expect(checkExperimentalManifest(experimental)).toEqual([])
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, private: false, publishConfig: { access: 'public' } },
    })).toEqual([
      '@lyness/experimental-prototype: experimental package must set "private": true',
      '@lyness/experimental-prototype: experimental package must omit publishConfig',
    ])
  })

  it('requires public metadata only for the Agent Teams exceptions', () => {
    expect(checkExperimentalManifest(publicExperimental)).toEqual([])
    expect(checkExperimentalManifest({
      ...publicExperimental,
      manifest: {
        name: '@lyness/experimental-agent-team',
        private: true,
      },
    })).toEqual([
      '@lyness/experimental-agent-team: public experimental package must not set "private": true',
      '@lyness/experimental-agent-team: public experimental package must set publishConfig.access to "public"',
    ])
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'] as const)(
    'rejects release %s on an experimental package',
    (section) => {
      expect(checkExperimentalDependencyIsolation([experimental, {
        dir: 'packages/core/consumer',
        manifest: {
          name: '@lyness/consumer',
          [section]: { '@lyness/experimental-prototype': 'workspace:^' },
        },
      }])).toEqual([
        `@lyness/consumer: ${section}.@lyness/experimental-prototype must not reference an experimental package`,
      ])
    },
  )

  it('allows development and experimental consumers but rejects the Python release runtime', () => {
    const manifests: WorkspaceManifest[] = [experimental, {
      dir: 'packages/core/test-only',
      manifest: {
        name: '@lyness/test-only',
        devDependencies: { '@lyness/experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'packages/experimental/consumer',
      manifest: {
        name: '@lyness/experimental-consumer',
        dependencies: { '@lyness/experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'python/sdk-runtime',
      manifest: {
        name: '@lyness/python-runtime',
        dependencies: { '@lyness/experimental-prototype': 'workspace:^' },
      },
    }]

    expect(checkExperimentalDependencyIsolation(manifests)).toEqual([
      '@lyness/python-runtime: dependencies.@lyness/experimental-prototype must not reference an experimental package',
    ])
  })
})

describe('lyn family version coherence', () => {
  it('rejects a package carrying a stale shared version', () => {
    expect(checkLynFamilyVersion(
      { name: '@lyness/http-proxy', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@lyness/http-proxy: package.json version must match root version 0.1.2-rc.1')
  })

  it('rejects the root-named CLI app on a stale shared version', () => {
    expect(checkLynFamilyVersion(
      { name: '@lyness/lyn', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@lyness/lyn: package.json version must match root version 0.1.2-rc.1')
  })

  it('accepts a manifest carrying the shared version', () => {
    expect(checkLynFamilyVersion(
      { name: '@lyness/http-proxy', version: '0.1.2-rc.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
  })

  it('leaves other sequences to their own version lines', () => {
    expect(checkLynFamilyVersion({ name: '@lyness/cordis', version: '4.0.1' }, '0.1.2-rc.1')).toBeUndefined()
    expect(checkLynFamilyVersion(
      { name: '@lyness/node-addon-system', version: '0.1.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
    expect(checkLynFamilyVersion({ version: '0.1.2-alpha.5' }, '0.1.2-rc.1')).toBeUndefined()
  })
})

describe('package payload constraints', () => {
  it('includes a declared profile patch without a package-name allowlist', () => {
    expect(expectedLynPackageFiles({
      name: '@lyness/private-profile',
      lyn: { bundle: { patch: './cordis.patch.yml' } },
    })).toEqual([
      'lib/index.js',
      'cordis.patch.yml',
      'lib/types/**/*.d.ts',
    ])
  })
})
