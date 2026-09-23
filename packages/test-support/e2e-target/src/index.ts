/**
 * Which DeepSeek-compatible platform the real-API e2e suites call.
 *
 * The suites read the same variables the product reads, so a run that points
 * at another platform points the product and the tests at it together:
 * `DEEPSEEK_BASE_URL` names the endpoint, `DEEPSEEK_MODELS` names the models
 * that endpoint serves, and `DEEPSEEK_API_KEY` is the key for it. With none of
 * them set, the target is the official API and its default model — exactly
 * what the suites called before they were configurable.
 *
 * A suite that exercises a feature only the official API has — prompt-cache
 * accounting, the Anthropic-compatible endpoint a Claude Code child uses —
 * skips on any other target rather than failing, because a red result there
 * would report the platform, not the code. So does a suite whose adapter
 * routes through a model catalog that describes the official ids alone, since
 * another platform's id has no route there at all.
 * @module @lyness/lyn-e2e-target
 */

import { MODELS_ENV, PUBLIC_BASE_URL, parseModelIds } from '@lyness/lyn-llm-deepseek'

/** The model the suites call when the environment names none. */
export const OFFICIAL_E2E_MODEL = 'deepseek-v4-flash'

/** The platform one e2e run calls. */
export interface E2eTarget {
  /** The model the suites send; the first id `DEEPSEEK_MODELS` names, or {@link OFFICIAL_E2E_MODEL}. */
  readonly model: string
  /** The endpoint the product calls, without a trailing slash. */
  readonly baseURL: string
  /** Whether that endpoint is the official DeepSeek API. */
  readonly official: boolean
}

/**
 * Resolve the platform from an environment table.
 * @param env - the variables to read; the suites pass `process.env`.
 * @returns the target those variables name.
 * @throws {Error} when `DEEPSEEK_MODELS` is set but names no model or a blank one.
 */
export function resolveE2eTarget(env: Readonly<Record<string, string | undefined>>): E2eTarget {
  const models = env[MODELS_ENV]
  const baseURL = (env.DEEPSEEK_BASE_URL ?? PUBLIC_BASE_URL).replace(/\/+$/u, '')
  return {
    model: models === undefined ? OFFICIAL_E2E_MODEL : parseModelIds(models)[0],
    baseURL,
    official: baseURL === PUBLIC_BASE_URL,
  }
}

/** The platform this process's e2e run calls. */
export const E2E_TARGET: E2eTarget = resolveE2eTarget(process.env)
