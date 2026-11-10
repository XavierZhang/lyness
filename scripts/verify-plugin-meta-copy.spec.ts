/**
 * What the plugin-name gate refuses: an English title that is the package
 * slug, and an English file that says less than the Chinese one beside it.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { pluginMetaProblems, slugTitle } from './verify-plugin-meta-copy.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A fixture repository holding one package's locale files. */
function repository(locales: Readonly<Record<string, string>>, pkg = 'tool-probe', group = 'probe'): string {
  const root = mkdtempSync(join(tmpdir(), 'lyn-plugin-meta-'))
  roots.push(root)
  const directory = join(root, 'packages', group, pkg, 'locale')
  mkdirSync(directory, { recursive: true })
  for (const [locale, body] of Object.entries(locales)) writeFileSync(join(directory, `${locale}.json`), body)
  return root
}

describe('reading a title', () => {
  it('calls a single lowercase token a slug, dots, slashes and dashes included', () => {
    for (const title of ['tool-fs', 'memory', 'api-gateway', 'office-to-pdf', '@lyness/lyn-tool-fs']) {
      expect(slugTitle(title), title).toBe(true)
    }
  })

  it('calls anything a reader reads as words a name', () => {
    for (const title of ['File read and write tools', 'DingTalk sign-in', 'pi-ai model adapter', 'Plan mode']) {
      expect(slugTitle(title), title).toBe(false)
    }
  })
})

describe('what the gate reports', () => {
  it('passes a package that names itself in English as fully as in Chinese', () => {
    const root = repository({
      en: '{"meta":{"title":"File read and write tools","description":"Lets the model edit files."}}',
      zh: '{"meta":{"title":"文件读写工具","description":"让 AI 编辑文件。"}}',
    })
    expect(pluginMetaProblems(root)).toEqual([])
  })

  it('reports an English title left as the package slug', () => {
    const root = repository({
      en: '{"meta":{"title":"tool-probe","description":"Probes."}}',
      zh: '{"meta":{"title":"探针工具","description":"探一下。"}}',
    })
    expect(pluginMetaProblems(root)).toEqual([
      'packages/probe/tool-probe/locale/en.json: meta.title "tool-probe" is a package slug, '
      + 'not a name an English reader can read',
    ])
  })

  it('reports a description the Chinese file has and the English one does not', () => {
    const root = repository({
      en: '{"meta":{"title":"Probe tool"}}',
      zh: '{"meta":{"title":"探针工具","description":"探一下。"}}',
    })
    expect(pluginMetaProblems(root)).toEqual([
      'packages/probe/tool-probe/locale/en.json: meta.description is missing, and locale/zh.json declares one',
    ])
  })

  it('reports a missing meta and a missing title', () => {
    expect(pluginMetaProblems(repository({ en: '{}' })))
      .toEqual(['packages/probe/tool-probe/locale/en.json: declares no meta; a package\'s locale file names the plugin'])
    expect(pluginMetaProblems(repository({ en: '{"meta":{"description":"Probes."}}' })))
      .toEqual(['packages/probe/tool-probe/locale/en.json: declares no meta.title'])
  })

  it('says so when it finds no locale file at all, rather than passing an empty scan', () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-plugin-meta-empty-'))
    roots.push(root)
    expect(pluginMetaProblems(root)).toEqual([`${root}: no plugin locale files found`])
  })

  it('accepts an English file with no Chinese counterpart', () => {
    expect(pluginMetaProblems(repository({ en: '{"meta":{"title":"Probe tool"}}' }))).toEqual([])
  })
})
