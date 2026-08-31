import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LYNESS_HOME_DISPLAY,
  LYNESS_HOME_DIR_NAME,
  canonicalizeWatchPath,
  defaultLynHome,
  lynHomeDisplay,
  lynHomePath,
  expandHomePath,
  resolveLynHome,
} from '@lyness/home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('lyn path helpers', () => {
  it('owns the shared default LYN home directory name', () => {
    expect(LYNESS_HOME_DIR_NAME).toBe('.lyn')
    expect(DEFAULT_LYNESS_HOME_DISPLAY).toBe('~/.lyn')
    expect(defaultLynHome()).toBe(join(homedir(), '.lyn'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.lyn')).toBe(join(homedir(), '.lyn'))
    expect(expandHomePath('~\\.lyn')).toBe(join(homedir(), '.lyn'))
    expect(expandHomePath('/tmp/.lyn')).toBe('/tmp/.lyn')
    expect(expandHomePath('~other/.lyn')).toBe('~other/.lyn')
  })

  it('resolves explicit path before LYNESS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-lyn')

    expect(resolveLynHome('/tmp/explicit-lyn', { LYNESS_HOME: '~/env-lyn' })).toBe(resolve('/tmp/explicit-lyn'))
    expect(resolveLynHome(undefined, { LYNESS_HOME: '~/env-lyn' })).toBe(envHome)
    expect(resolveLynHome(undefined, {})).toBe(defaultLynHome())
  })

  it('treats an empty or whitespace-only LYNESS_HOME as unset', () => {
    expect(resolveLynHome(undefined, { LYNESS_HOME: '' })).toBe(defaultLynHome())
    expect(resolveLynHome(undefined, { LYNESS_HOME: '   ' })).toBe(defaultLynHome())
  })

  it('joins child segments onto the resolved LYNESS_HOME', () => {
    vi.stubEnv('LYNESS_HOME', '~/env-lyn')
    expect(lynHomePath()).toBe(join(homedir(), 'env-lyn'))
    expect(lynHomePath('storages', 'cache')).toBe(join(homedir(), 'env-lyn', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(lynHomeDisplay(resolve(defaultLynHome()))).toBe('~/.lyn')
    expect(lynHomeDisplay('/some/other/root')).toBe('$LYNESS_HOME')
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lyn-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
