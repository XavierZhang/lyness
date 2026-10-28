/**
 * The rebrand survives an upstream sync only if it can be undone and redone.
 *
 * Syncing runs the codemod backwards onto upstream naming, merges upstream, and
 * runs it forwards again. Anything the backward pass spells differently from
 * upstream stops matching the file it came from, and anything the forward pass
 * cannot put back is lost from the fork — so `forward(backward(x)) === x` is
 * the property the whole sync procedure rests on, for text and for paths.
 *
 * Every case here is written in FORK naming and the upstream spelling is
 * derived by running the rules backwards. Naming upstream directly would not
 * survive the codemod: a forward run over this file would rewrite the upstream
 * literal into the fork one, both sides of the assertion would read the same,
 * and the test would pass while proving nothing.
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RULES, renamePath, rewrite } from './rebrand.ts'

const root = resolve(import.meta.dirname, '..')

/** Text whose forward rename shares its result with another rule's, or runs through a shield. */
const AMBIGUOUS_TEXT: readonly string[] = [
  '@lyness/lyn-session imports @lyness/lyn-agent',
  'const home = process.env.LYNESS_HOME',
  'lyn_home=str(lyn_home)',
  'export const IDENTITY_COOKIE = \'lyn_identity\'',
  'the lyness-sdk-runtime-darwin-arm64 executable',
  'import lyness_runtime from the wheel',
  'mkdtempSync(join(tmpdir(), \'lyn-persistence-formats-\'))',
  '~/.lyn holds the LYNESS_HOME profile',
]

/** Paths whose product segment carries no separator, so only the path rule can place it. */
const PATHS: readonly string[] = [
  'packages/client/ui-brand-lyness/src/client/Brand.tsx',
  'python/sdk/src/lyness/client.py',
  'python/sdk-runtime/src/lyness_runtime/_resources.py',
  '.agents/notes/implemented/architecture/2026-09-15-lyness-brand-in-the-web-client.md',
  'packages/llm/llm-deepseek/src/index.ts',
]

/** The sentinels the shield rules park names under mid-run; none may outlive a pass. */
const SENTINEL = '\u0000'

function backward(text: string): string {
  return rewrite(text, RULES, true).text
}

function forward(text: string): string {
  return rewrite(text, RULES, false).text
}

describe('rebrand round trip', () => {
  it('puts back every name the backward pass renames', () => {
    for (const fork of AMBIGUOUS_TEXT) expect(forward(backward(fork)), fork).toBe(fork)
  })

  it('puts back every path the backward pass renames', () => {
    for (const fork of PATHS) {
      expect(renamePath(renamePath(fork, RULES, true), RULES, false), fork).toBe(fork)
    }
  })

  it('leaves no shield sentinel behind in either direction', () => {
    for (const fork of AMBIGUOUS_TEXT) {
      expect(backward(fork), fork).not.toContain(SENTINEL)
      expect(forward(backward(fork)), fork).not.toContain(SENTINEL)
    }
  })

  it('spells every tracked path backwards without a space', () => {
    // Upstream carries no path with a space in it, and a renamed path that
    // gains one neither matches the upstream file it came from — so a sync
    // reads an unrelated addition and drops upstream's changes to it — nor
    // survives the tools that read it. Reads the tracked paths rather than a
    // list, so a path the backward spellings do not reach fails here instead of
    // at the next sync. A failure is answered with a backward spelling that
    // names the new form, not with an exception.
    // Past Node's 1 MiB default, execFileSync kills git and reports a signal
    // rather than the size, so the listing would read as a hang.
    const tracked = execFileSync('git', ['ls-files'], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    }).split('\n').filter(Boolean)
    expect(tracked.length).toBeGreaterThan(10_000)
    expect(tracked.map(file => renamePath(file, RULES, true)).filter(file => file.includes(' '))).toEqual([])
  })

  it('renames the text a backward path implies the same way', () => {
    // A path and the references to it are renamed by separate passes, so a rule
    // that reaches one but not the other leaves dead links behind.
    for (const fork of PATHS) expect(backward(fork), fork).toBe(renamePath(fork, RULES, true))
  })
})
