/**
 * The model-facing write path for durable memory. Separate from the service
 * entry so a composition can keep memories readable in the prompt without
 * letting the agent write them.
 * @module @lyness/lyn-memory/tools
 */

import type { Context } from '@lyness/cordis'
import { defineTool } from '@lyness/lyn-tools'
import { brandString } from '@lyness/lyn-brand'
import type {} from './index.ts'
import { MAX_ENTRY_CHARS } from './storage.ts'
import type { MemoryId, MemoryRecord } from './types.ts'

/** Every memory tool returns plain text the model reads directly. */
const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'memory-tools'

/** The memory service owning durable reads and writes. */
export const inject = ['memory', 'tools']

/** One memory tool's presentation card. */
export interface MemoryCallCard {
  /** Card renderer id. */
  readonly card: 'generic'
  /** Title shown on the call row. */
  readonly title: string
  /** Whether the call reads or changes stored memory. */
  readonly kind: 'read' | 'execute'
}

/**
 * Presentation for one memory call. Pure, so the Host presenter stays pure
 * and the titles are checkable without a running tool registry.
 * @param tool - the registered tool's name.
 * @param args - that tool's arguments.
 * @returns the call card.
 */
export function memoryCallCard(tool: string, args: { text?: string; id?: string }): MemoryCallCard {
  if (tool === 'memory_write') return { card: 'generic', title: `Remember ${args.text ?? ''}`, kind: 'execute' }
  if (tool === 'memory_forget') return { card: 'generic', title: `Forget ${args.id ?? ''}`, kind: 'execute' }
  return { card: 'generic', title: 'List remembered facts', kind: 'read' }
}

/**
 * Render stored records for a tool result.
 * @param records - stored records in write order.
 * @returns one line per record, or a statement that nothing is kept.
 */
export function renderRecords(records: readonly MemoryRecord[]): string {
  if (records.length === 0) return 'Nothing is remembered yet.'
  return records.map(record => `${record.id}\t${record.text}`).join('\n')
}

/**
 * Register the explicit memory tools.
 * @param ctx - context providing the memory service and the tool registry.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'memory_write',
    description: 'Remember one durable fact about this workspace or the people in it, so later sessions start with it. '
      + 'Use it when the user asks you to remember something, or states a lasting preference or convention. '
      + 'Do not record task state, secrets, or anything the user did not mean to keep.',
    parameters: {
      text: { type: 'string', required: true, description: `The fact to keep, at most ${String(MAX_ENTRY_CHARS)} characters.` },
    },
    output: TEXT_OUTPUT,
    async execute(args: { text: string }) {
      const record = await ctx.memory.remember(args.text)
      return `Remembered as ${record.id}.`
    },
    presentCall: (args: { text: string }) => memoryCallCard('memory_write', args),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'memory_list',
    description: 'List every remembered fact with its id. The same facts are already in your context; '
      + 'call this only when you need an id to remove one.',
    parameters: {},
    output: TEXT_OUTPUT,
    async execute() {
      return renderRecords(await ctx.memory.list())
    },
    presentCall: () => memoryCallCard('memory_list', {}),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'memory_forget',
    description: 'Remove one remembered fact by its id, after the user asks for it to be forgotten or corrects it.',
    parameters: {
      id: { type: 'string', required: true, description: 'The id `memory_list` reported for that fact.' },
    },
    output: TEXT_OUTPUT,
    async execute(args: { id: string }) {
      const removed = await ctx.memory.forget(brandString<MemoryId>(args.id))
      return removed ? `Forgot ${args.id}.` : `No remembered fact carries the id ${args.id}.`
    },
    presentCall: (args: { id: string }) => memoryCallCard('memory_forget', args),
  })))
}
