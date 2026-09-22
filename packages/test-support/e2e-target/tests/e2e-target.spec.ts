/** Which platform an environment table names, and what it refuses. */

import { describe, expect, it } from 'vitest'
import { E2E_TARGET, OFFICIAL_E2E_MODEL, resolveE2eTarget } from '../src/index.ts'

describe('the e2e target', () => {
  it('is the official API and its default model when nothing is configured', () => {
    expect(resolveE2eTarget({})).toEqual({
      model: OFFICIAL_E2E_MODEL,
      baseURL: 'https://api.deepseek.com',
      official: true,
    })
  })

  it('follows the endpoint and the first model the environment names', () => {
    expect(resolveE2eTarget({
      DEEPSEEK_BASE_URL: 'https://gateway.example/v1/',
      DEEPSEEK_MODELS: 'deepseek-ai/DeepSeek-V4-Flash, deepseek-ai/DeepSeek-V4-Pro',
    })).toEqual({
      model: 'deepseek-ai/DeepSeek-V4-Flash',
      baseURL: 'https://gateway.example/v1',
      official: false,
    })
  })

  it('treats the official endpoint written with a trailing slash as official', () => {
    expect(resolveE2eTarget({ DEEPSEEK_BASE_URL: 'https://api.deepseek.com/' }).official).toBe(true)
  })

  it('refuses a model list that names a blank model', () => {
    expect(() => resolveE2eTarget({ DEEPSEEK_MODELS: ' ' })).toThrow(/DEEPSEEK_MODELS must be a comma-separated list/u)
  })

  it('resolves this process once from its own environment', () => {
    expect(E2E_TARGET).toEqual(resolveE2eTarget(process.env))
  })
})
