/**
 * Real-API e2e: the character a bot carries actually reaches the model and
 * decides how it answers.
 *
 * Everything else about a bot is pinned without a key — the roster, the
 * refusals, the prompt section's own text, the engagement event a session
 * records. What only a real request can show is that the assembled system
 * prompt makes the model answer as that bot rather than as the deployment's
 * default agent, which is the one claim the whole feature rests on.
 *
 * Key-gated, and endpoint-agnostic: it asks whichever platform
 * `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODELS` name. That platform has to
 * implement the Messages stream correctly — an endpoint that omits `index` on
 * the first `content_block_start` fails the baseline turn below, and the
 * failure reports the endpoint rather than this feature.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import SystemPrompt, { renderPrompt } from '@lyness/lyn-system-prompt'
import { composeBotPersona } from '@lyness/lyn-managed-bots/session'
import type { EngagedBot } from '@lyness/lyn-managed-bots/session'
import LlmRuntime, { BlockAssembler, createSystemMessage, createUserMessage, ReasoningEffortId } from '@lyness/lyn-llm'
import * as Messages from '@lyness/lyn-llm-deepseek-api-key'
import { E2E_TARGET } from '@lyness/lyn-e2e-target'

/** One bot whose character is impossible to follow by accident. */
const TRIAGE: EngagedBot = {
  bot: 'triage',
  displayName: 'Triage',
  persona: 'Whatever you are asked about, reply with exactly the single word PINEAPPLE and nothing else.'
    + ' Never answer the question itself.',
}

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** A deployment that assembles prompts and can reach the configured endpoint. */
async function bench(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Messages, {
    baseURL: E2E_TARGET.baseURL,
    models: [{ id: E2E_TARGET.model }],
    maxTokens: 256,
  })
  return ctx
}

/** The complete text one turn would send as its system message. */
async function systemPrompt(ctx: Context): Promise<string> {
  return renderPrompt(await ctx.systemPrompt.assemble())
}

/**
 * Ask the configured model one question under one system prompt.
 * @param ctx - the booted deployment.
 * @param system - the assembled system prompt.
 * @param question - the user turn.
 * @returns the assistant's text.
 */
async function ask(ctx: Context, system: string, question: string): Promise<string> {
  const assembler = new BlockAssembler()
  const stream = ctx.llm.stream({
    provider: 'deepseek-official',
    model: E2E_TARGET.model,
    reasoningEffort: ReasoningEffortId('off'),
    messages: [
      createSystemMessage(system),
      createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: question }] }),
    ],
  })
  for await (const chunk of stream) assembler.push(chunk)
  return assembler.blocks().flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}

const QUESTION = 'What is the capital of France?'

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('a bot\'s character reaching the model', () => {
  it('answers as the bot rather than answering the question', async () => {
    const ctx = await bench()
    const withoutBot = await systemPrompt(ctx)
    // The baseline is the same deployment one line earlier: without the bot
    // section, this model answers the question.
    expect(await ask(ctx, withoutBot, QUESTION)).toMatch(/Paris/iu)

    composeBotPersona(ctx, TRIAGE)
    const withBot = await systemPrompt(ctx)
    // The section is appended, not substituted: the deployment's own prompt
    // is still in front of it.
    expect(withBot.startsWith(withoutBot.split('\n\n')[0] ?? '')).toBe(true)
    expect(withBot).toContain('You are Triage.')

    const answer = await ask(ctx, withBot, QUESTION)
    expect(answer).toMatch(/PINEAPPLE/u)
    expect(answer).not.toMatch(/Paris/iu)
  }, 120_000)

  it('stops deciding the answer once the bot is withdrawn', async () => {
    const ctx = await bench()
    const withdraw = composeBotPersona(ctx, TRIAGE)
    expect(await systemPrompt(ctx)).toContain('PINEAPPLE')

    withdraw()
    const after = await systemPrompt(ctx)
    expect(after).not.toContain('PINEAPPLE')
    // A conversation whose bot left runs as the deployment's own agent again,
    // which is what makes the section a per-session composition rather than
    // a deployment-wide one.
    expect(await ask(ctx, after, QUESTION)).toMatch(/Paris/iu)
  }, 120_000)
})
