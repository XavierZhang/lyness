/**
 * An adapter whose every turn answers with whatever prose the test set.
 *
 * The ask path is exercised against the production agent loop rather than a
 * stand-in agent: what this file replaces is the model, so the session the
 * answering turn writes — its turn boundaries, its assistant message, its
 * surface markers — is the shipping code's own.
 */

import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'

/** The adapter route these tests register. */
export const ANSWERING_PROVIDER = 'answering'

/** One scripted answer: prose, or nothing at all. */
export interface ScriptedAnswer {
  /** The prose the turn says; an empty string answers with no text block. */
  readonly text: string
  /** Whether to follow it with a second message carrying no prose. */
  readonly thenSilent?: boolean
}

/** Adapter answering from a script the test owns. */
export class AnsweringAdapter extends LlmAdapter {
  /** The answer every turn gives, which a test reassigns between asks. */
  answer: ScriptedAnswer = { text: 'The capital is Paris.' }

  /** Every request this adapter served, for assertions about the prompt. */
  readonly requests: GenerateOptions[] = []

  /**
   * Describe the requested route back without consulting any catalog.
   * @param provider - the requested provider route.
   * @param model - the requested model id.
   * @returns the route as this adapter serves it.
   */
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  /**
   * Stream the scripted answer.
   * @param options - the assembled request.
   * @returns the chunks one turn consumes.
   */
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const { text, thenSilent } = this.answer
    if (text !== '') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    }
    if (thenSilent === true) {
      // A turn that ends on reasoning alone records an assistant message with
      // no prose; the asker is told the last message that had some.
      yield { type: 'block-start', index: 1, blockType: 'reasoning' }
      yield { type: 'reasoning-delta', index: 1, text: 'still thinking' }
      yield { type: 'block-end', index: 1, block: { type: 'reasoning', text: 'still thinking' } }
    }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

/**
 * A scripted answer per request, so a room can be given a different remark
 * from each speaker and a conclusion from the chair.
 *
 * Its own class rather than a mode on the one above: a room's assertions are
 * about who said what, and a single answer could not tell two speakers apart.
 */
export class TakingTurnsAdapter extends LlmAdapter {
  /** The answers to give, consumed in request order; the last one repeats. */
  answers: readonly string[] = ['said something']

  /** Request indexes whose answer is reasoning rather than prose. */
  silent: readonly number[] = []

  /** Every request this adapter served, in order. */
  readonly requests: GenerateOptions[] = []

  /**
   * Describe the requested route back without consulting any catalog.
   * @param provider - the requested provider route.
   * @param model - the requested model id.
   * @returns the route as this adapter serves it.
   */
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  /**
   * Stream the next scripted answer.
   * @param options - the assembled request.
   * @returns the chunks one turn consumes.
   */
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const index = this.requests.length
    this.requests.push(options)
    const text = this.answers[index] ?? this.answers.at(-1) ?? ''
    if (this.silent.includes(index)) {
      // A turn that ends on reasoning alone carries no prose for a reader to
      // take, which is not the same as carrying nothing at all.
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      yield { type: 'reasoning-delta', index: 0, text: 'thinking' }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'thinking' } }
    } else if (text !== '') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
