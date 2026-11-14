/**
 * Host Remote owner of the `personalInstructions` namespace: what one person
 * told their own agents, read and written by that person alone.
 *
 * Whose instructions a call acts on is never a parameter. The store answers
 * it from the principal the call published, so a caller cannot name somebody
 * else's record by asking for it; the namespace additionally requires a
 * caller the deployment knows, which is what makes that principal present.
 *
 * @module @lyness/lyn-api-personal-instructions-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-personal-instructions'
import type { InstructionsView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `personalInstructions` Remote namespace. */
    personalInstructionsController: PersonalInstructionsController
  }
}

/** Host service backing the generated `ctx.remote.personalInstructions` namespace. */
export default class PersonalInstructionsController extends TypertRemoteService {
  static inject = ['personalInstructions']

  /**
   * Register the namespace.
   * @param ctx - Host context carrying the instructions store.
   */
  constructor(ctx: Context) {
    super(ctx, 'personalInstructionsController', { namespace: 'personalInstructions', requires: 'member' })
  }

  /**
   * Read this caller's own instructions.
   * @returns the saved text and what this deployment accepts.
   */
  @Remote
  describe(): InstructionsView {
    const store = this.ctx.personalInstructions
    const owner = store.ownerOfCall()
    if (owner === undefined) return { owned: false, text: '', maxChars: store.maxChars }
    const entry = store.get(owner)
    return {
      owned: true,
      text: entry?.text ?? '',
      ...entry === undefined ? {} : { writtenAt: entry.writtenAt },
      maxChars: store.maxChars,
    }
  }

  /**
   * Replace this caller's own instructions.
   *
   * Blank text clears them. The answer is read back from the store rather
   * than echoed, so the page shows what was kept rather than what was sent.
   * @param text - the new instructions; blank clears them.
   * @returns the stored state after the write.
   * @throws {Error} when the call speaks for nobody, or the text exceeds what this deployment accepts.
   */
  @Remote
  async save(text: string): Promise<InstructionsView> {
    const store = this.ctx.personalInstructions
    const owner = store.ownerOfCall()
    if (owner === undefined) throw new Error('personalInstructions: this call speaks for nobody')
    await store.save(owner, text)
    return this.describe()
  }
}
