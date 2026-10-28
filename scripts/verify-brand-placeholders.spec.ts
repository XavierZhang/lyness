import { describe, expect, it } from 'vitest'
import { dictionaryFiles, findBrandPlaceholderViolations } from './verify-brand-placeholders.ts'

function names(source: string): string[] {
  return findBrandPlaceholderViolations('packages/client/ui-example/src/client/locales.ts', source)
    .map(violation => violation.text)
}

describe('brand placeholder dictionary check', () => {
  it('rejects every product name a dictionary could write literally', () => {
    expect(names(`
      export const en = {
        inUse: 'Another running DSH holds this session.',
        upgrade: 'Upgrade DeepSeek Harness and try again.',
        shout: 'DSHESS is unavailable',
        zh: '退出其他正在运行的领驭后重试',
      }
    `)).toEqual([
      'Another running DSH holds this session.',
      'Upgrade DeepSeek Harness and try again.',
      'DSHESS is unavailable',
      '退出其他正在运行的领驭后重试',
    ])
  })

  it('accepts the placeholders that replace them, and the command name', () => {
    expect(names(`
      export const en = {
        inUse: 'Another running {brandAbbr} holds this session (such as dsh web).',
        upgrade: 'Upgrade {brandName} and try again.',
        label: '{brandNameZh}本地构建',
      }
    `)).toEqual([])
  })

  it('accepts package names, which are external identifiers', () => {
    expect(names(`
      import type {} from '@deepseek-ai/dsh-client-ui-slots'
      export const en = {
        installExample: 'for example @deepseek-ai/dsh-subagent-codex',
        idHint: 'The plugin package name is the npm package name (like dsh-xxx).',
      }
      declare module '@deepseek-ai/dsh-client-ui-slots' {
        interface LocaleNamespaceMap { example: string }
      }
    `)).toEqual([])
  })

  it('reads dictionary values, not the keys that address them', () => {
    expect(names(`
      export const en = { 'DSH': 'ok', DeepSeek Harness: 'ok' }
      interface Keys { 'DSH': string }
    `)).toEqual([])
  })

  it('reads the literal parts of an interpolated string', () => {
    expect(names('export const en = { note: `Quit DSH, then ${action} it` }')).toEqual(['Quit DSH, then'])
  })

  it('discovers the shipped dictionaries alongside the per-feature ones', () => {
    const files = dictionaryFiles()
    expect(files).toContain('packages/client/locale/src/locales/en.ts')
    expect(files).toContain('packages/client/ui-plugin-manager/src/client/locales.ts')
    expect(files).toContain('packages/client/ui-agent-preset/src/client/guide-locales.ts')
  })
})
