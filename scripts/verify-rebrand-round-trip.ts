/**
 * Gate for the rebrand's reversibility over the real tree: the backward pass
 * followed by the forward pass must return every tracked file to its own bytes.
 *
 * `rebrand-round-trip.spec.ts` proves the same property for spellings somebody
 * thought to list, which is what keeps that spec fast. A sync runs the codemod
 * over the whole repository, so the spellings that matter are the ones only the
 * tree carries: a missed one is, by definition, not in a fixture. Reading every
 * file reports the file and the line here instead of a merge conflict nobody
 * can explain three steps later.
 *
 * What it cannot check is byte equality with upstream. The forward pass maps
 * three upstream spellings — `deepseek-harness`, `deepseek_harness`, and the
 * spaced product name — onto the fork's one name, and a census of the files the
 * fork has not edited finds every high-volume context carrying at least two of
 * the three (805 product-name, 369 hyphen, 81 underscore occurrences with no
 * adjacent separator to tell them apart). No literal rule can recover which
 * one a given occurrence was, so the reversed tree differs from upstream in
 * spelling while renaming forward to exactly the fork's bytes. CUSTOM.md
 * records the measurement and why the drift costs only a conflict on a line
 * upstream also edited.
 *
 * @module verify-rebrand-round-trip
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { RULES, protectedRules, rewrite } from './rebrand.ts'

const root = resolve(import.meta.dirname, '..')

/** Past Node's 1 MiB default, `execFileSync` kills git and reports a signal rather than the size. */
const LISTING_BUFFER_BYTES = 64 * 1024 * 1024

/** How many breaks to describe before summarizing the rest. */
const REPORTED = 20

/** One file the codemod cannot return to its own bytes. */
export interface RoundTripBreak {
  /** Repository-relative path. */
  readonly file: string
  /** One-based line that first differs. */
  readonly line: number
  /** The file's own text on that line. */
  readonly before: string
  /** What the backward-then-forward pass produced instead. */
  readonly after: string
}

/**
 * Run the codemod backwards then forwards over every tracked text file.
 * @returns the files read and every file that did not return to its own bytes.
 */
export function verifyRebrandRoundTrip(): { readonly read: number; readonly breaks: readonly RoundTripBreak[] } {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: LISTING_BUFFER_BYTES,
  }).split('\0').filter(file => file !== '')

  const breaks: RoundTripBreak[] = []
  let read = 0
  for (const file of tracked) {
    const skip = protectedRules(file)
    if (skip === 'all') continue
    const path = resolve(root, file)
    // A gitlink entry lists as a tracked path but is a directory on disk.
    if (!statSync(path).isFile()) continue
    let text: string
    try {
      text = new TextDecoder('utf8', { fatal: true }).decode(readFileSync(path))
    } catch {
      // Swallows TextDecoder's decode failure alone: bytes that are not UTF-8
      // are left byte-for-byte alone by the codemod, so they cannot drift.
      continue
    }
    read += 1
    const again = rewrite(rewrite(text, RULES, true, skip).text, RULES, false, skip).text
    if (again === text) continue
    const before = text.split('\n')
    const after = again.split('\n')
    const index = before.findIndex((value, at) => value !== after[at])
    breaks.push({ file, line: index + 1, before: before[index] ?? '', after: after[index] ?? '(file ends)' })
  }
  return { read, breaks }
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const { read, breaks } = verifyRebrandRoundTrip()
  if (breaks.length === 0) {
    console.log(`verify-rebrand-round-trip: ${String(read)} text file(s) return to their own bytes.`)
  } else {
    console.error(`verify-rebrand-round-trip: ${String(breaks.length)} of ${String(read)} text file(s) do not survive a reverse and a rename:`)
    for (const found of breaks.slice(0, REPORTED)) {
      console.error(`  ${found.file}:${String(found.line)}`)
      console.error(`    before: ${found.before.trim()}`)
      console.error(`    after:  ${found.after.trim()}`)
    }
    if (breaks.length > REPORTED) console.error(`  … and ${String(breaks.length - REPORTED)} more`)
    console.error('  Give the owning rule a backward spelling that names the form above, or shield it.')
    process.exit(1)
  }
}
