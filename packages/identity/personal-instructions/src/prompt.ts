/**
 * How a person's own instructions reach the model.
 *
 * Its own unit because the two facts worth pinning are here and nowhere else:
 * the exact words the model reads, and the position they hold among the
 * layers above and below them.
 *
 * @module @lyness/lyn-personal-instructions/prompt
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-system-prompt'
import type { PersonalInstructionsRecord } from './types.ts'

/** Prompt section carrying what the person in the conversation asked for. */
export const PERSON_INSTRUCTIONS_SECTION = 'person:instructions'

/**
 * The person's instructions, as the model reads them.
 *
 * Introduced as the person's own words rather than as a stored setting: a
 * prompt carries task-relevant concepts, and the model needs to know who
 * wrote this, not where it is kept.
 * @param text - the instructions this session recorded, verbatim.
 * @returns the section text, or the empty string when the person wrote none.
 */
export function instructionsText(text: string): string {
  const stated = text.trim()
  if (stated === '') return ''
  return `The person in this conversation has written these instructions for you:\n\n${stated}`
}

/**
 * Compose one session's recorded instructions into its agent's prompt.
 *
 * Registered on the agent's own context, so the text lasts exactly as long as
 * that agent and cannot reach another person's conversation. It is placed
 * after the organization's rules and before the agent's own persona and every
 * policy section, which is what keeps text a person wrote from widening what
 * their agent may do.
 * @param agentCtx - the agent scope to register the section on.
 * @param record - the instructions this session was created with.
 * @returns the disposer that withdraws the section.
 */
export function composeInstructions(agentCtx: Context, record: PersonalInstructionsRecord): () => void {
  return agentCtx.systemPrompt.section({
    name: PERSON_INSTRUCTIONS_SECTION,
    order: agentCtx.systemPrompt.getSectionOrder('PERSON_INSTRUCTIONS'),
    text: instructionsText(record.text),
  })
}
