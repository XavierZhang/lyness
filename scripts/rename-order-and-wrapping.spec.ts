/**
 * Expected outputs a rename invalidates without changing their text.
 *
 * A textual codemod rewrites names in place. It cannot carry the two things
 * that follow from a name: the ORDER of anything sorted by name, and the
 * LENGTH of anything wrapped to a width. Both have broken here — the snapshot
 * tool list lost its order twice (`subagent_dsh_sdk` sorted before
 * `subagent_fork`, `subagent_lyn_sdk` after it), and the launcher help kept a
 * wrap point computed for a name nine characters longer. Both are mechanical,
 * so they are checked rather than reviewed by hand.
 *
 * These are expected-output invariants, so they run in the unit lane beside the
 * fixtures they read rather than as a separate gate process.
 */
import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

/** Discovery guards: the fixtures present when these checks were written. */
const MINIMUM_TOOL_SCHEMAS = 40
const MINIMUM_SORTED_LITERALS = 60

/** Commander wraps the launcher help to this width; its examples are added unwrapped. */
const HELP_WIDTH = 80

/** Column the launcher help's description text starts at, after the term column. */
const HELP_DESCRIPTION_COLUMN = 33

const HELP_FIXTURE = 'apps/cli/tests/expected/launcher-help.txt'

/** This file, which the sorted-expectation scan reads past: it holds the counter-examples. */
const SELF = 'scripts/rename-order-and-wrapping.spec.ts'

/**
 * Read one repository file.
 * @param file - repository-relative path.
 * @returns the file's text.
 */
function read(file: string): string {
  return readFileSync(resolve(root, file), 'utf8')
}

/** One `.sort()).toEqual([…])` expectation whose array is all string literals. */
interface SortedExpectation {
  /** One-based line within the source read. */
  line: number
  /** The literal strings, in the order the source writes them. */
  items: string[]
}

const SORTED_EXPECTATION = /\.sort\(\)\)\.toEqual\(\[([^\]]*)\]/u
const STRING_LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/gu

/**
 * Read the sorted expectations this check can judge from one source file.
 *
 * An array holding anything but string literals — a variable, a template, a
 * nested call — states its order elsewhere, so it is left alone.
 * @param source - complete source text.
 * @returns one entry per readable expectation, in source order.
 */
function sortedExpectations(source: string): SortedExpectation[] {
  const found: SortedExpectation[] = []
  for (const [index, line] of source.split('\n').entries()) {
    const match = SORTED_EXPECTATION.exec(line)
    if (match === null) continue
    const body = match[1] ?? ''
    const items = [...body.matchAll(STRING_LITERAL)].map(literal => literal[1] ?? literal[2] ?? '')
    const remainder = body.replaceAll(STRING_LITERAL, '').replaceAll(/[\s,]/gu, '')
    if (remainder !== '' || items.length === 0) continue
    found.push({ line: index + 1, items })
  }
  return found
}

/**
 * The expectations whose literal array is out of order.
 * @param source - complete source text.
 * @returns the offending entries.
 */
function unsortedExpectations(source: string): SortedExpectation[] {
  return sortedExpectations(source)
    .filter(({ items }) => items.join('\u0000') !== [...items].sort().join('\u0000'))
}

/**
 * Whether the second line continues the first inside a wrapped block.
 *
 * A continuation either resumes the description column of a two-column entry or
 * carries a paragraph at the same indent; a new term starts further left.
 * @param line - the candidate wrapped line.
 * @param next - the line after it.
 * @returns true when `next` holds text wrapped off `line`.
 */
function continues(line: string, next: string): boolean {
  if (next.trim() === '' || line.trim() === '' || line.endsWith(':')) return false
  const indent = line.length - line.trimStart().length
  const nextIndent = next.length - next.trimStart().length
  if (nextIndent === HELP_DESCRIPTION_COLUMN) {
    return indent < HELP_DESCRIPTION_COLUMN ? line.length > HELP_DESCRIPTION_COLUMN : indent === nextIndent
  }
  return indent === nextIndent && indent === 0
}

/**
 * Lines of wrapped help whose wrap no longer matches the text they carry.
 *
 * A line that could take the first word of its continuation was wrapped for
 * longer text; a line past the width was wrapped for shorter text.
 * @param help - complete help text, including the unwrapped examples.
 * @returns one-based line numbers, in order.
 */
function staleWraps(help: string): number[] {
  const lines = help.split('\n')
  const end = lines.findIndex(line => line.startsWith('Examples:'))
  const wrapped = end === -1 ? lines : lines.slice(0, end)
  const stale: number[] = []
  for (const [index, line] of wrapped.entries()) {
    const next = wrapped[index + 1]
    const room = next !== undefined && continues(line, next)
      && line.length + 1 + (next.trim().split(' ')[0] ?? '').length <= HELP_WIDTH
    if (line.length > HELP_WIDTH || room) stale.push(index + 1)
  }
  return stale
}

describe('expected outputs that depend on a name', () => {
  it('keeps every snapshot tool list in the order the tool registry emits', () => {
    const files = globSync('snapshots/**/tool-schemas.expected.json', { cwd: root }).sort()
    expect(files.length, 'tool-schema discovery narrowed').toBeGreaterThanOrEqual(MINIMUM_TOOL_SCHEMAS)
    for (const file of files) {
      const parsed: unknown = JSON.parse(read(file))
      if (typeof parsed !== 'object' || parsed === null) throw new Error(`${file} is not an object`)
      const initial: unknown = Reflect.get(parsed, 'initial')
      if (!Array.isArray(initial)) continue
      const names = initial
        .map((tool: unknown): unknown => typeof tool === 'object' && tool !== null ? Reflect.get(tool, 'name') : undefined)
        .filter((name: unknown): name is string => typeof name === 'string')
      expect(names, file).toEqual([...names].sort())
    }
  })

  it('keeps a sorted expectation sorted, so a renamed member moves with its name', () => {
    const files = globSync(['packages/*/*/tests/**/*.{ts,tsx}', 'apps/*/tests/**/*.{ts,tsx}', 'scripts/*.spec.ts'], { cwd: root })
      .map(file => file.replaceAll('\\', '/'))
      // This file states out-of-order arrays on purpose, as the cases proving
      // the check rejects them.
      .filter(file => file !== SELF)
      .sort()
    let readable = 0
    for (const file of files) {
      const source = read(file)
      readable += sortedExpectations(source).length
      expect(unsortedExpectations(source).map(entry => `${file}:${String(entry.line)}`), file).toEqual([])
    }
    expect(readable, 'sorted-expectation discovery narrowed').toBeGreaterThanOrEqual(MINIMUM_SORTED_LITERALS)
  })

  it('keeps the launcher help wrapped as the current names wrap', () => {
    const help = read(HELP_FIXTURE)
    expect(help.includes('\nExamples:'), 'the help fixture must keep its unwrapped Examples block').toBe(true)
    expect(staleWraps(help).map(line => `${HELP_FIXTURE}:${String(line)}`)).toEqual([])
  })

  it('refuses an expectation a rename left out of order', () => {
    expect(unsortedExpectations("expect(names.sort()).toEqual(['lyn', 'fork'])\n").map(entry => entry.items))
      .toEqual([['lyn', 'fork']])
    // Arrays the check cannot read state their order elsewhere.
    expect(unsortedExpectations('expect(names.sort()).toEqual([second, first])\n')).toEqual([])
    expect(unsortedExpectations("expect(names.sort()).toEqual(['b', ...rest])\n")).toEqual([])
  })

  it('refuses a wrap a rename left too early or too wide', () => {
    const term = ' '.repeat(2) + '--profile <name>'
    const pad = ' '.repeat(HELP_DESCRIPTION_COLUMN - term.length)
    const early = `${term}${pad}short text that stops\n${' '.repeat(HELP_DESCRIPTION_COLUMN)}early\nExamples:\n`
    expect(staleWraps(early)).toEqual([1])

    const wide = `${term}${pad}${'x'.repeat(HELP_WIDTH)}\nExamples:\n`
    expect(staleWraps(wide)).toEqual([1])

    const filled = `${term}${pad}${'x'.repeat(HELP_WIDTH - HELP_DESCRIPTION_COLUMN)}\n${' '.repeat(HELP_DESCRIPTION_COLUMN)}next\nExamples:\n`
    expect(staleWraps(filled)).toEqual([])
  })
})
