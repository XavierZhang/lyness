/**
 * Rebrand the harness from DeepSeek Harness to lyness, and undo that rebrand
 * with `--reverse`. The fork publishes under its own identity, so every name
 * the upstream product owns — npm scope, CLI command, home directory,
 * environment prefix, display name, repository URL — moves to the fork's.
 *
 * This codemod follows [`rescope-vendor.ts`](./rescope-vendor.ts): ordered
 * literal rules, a protected-path list, post-state assertions, and a `--check`
 * mode that verifies them. Sites a token rule cannot express — a regex literal
 * whose separator is escaped, a label built by concatenation, a fixture name
 * whose meaning depends on sharing the product's prefix — are their own narrow
 * rules rather than a separate edit list, each carrying why the general rules
 * cannot see it. That is what makes the rebrand re-appliable after every
 * upstream sync.
 *
 * DeepSeek names TWO different things in this tree and only one of them is the
 * brand. `DeepSeek Harness`, `deepseek-harness`, and the `@deepseek-ai` scope
 * are the harness; a bare `DeepSeek`, `api.deepseek.com`, and the
 * `llm-deepseek` provider are the MODEL VENDOR, which the product still calls.
 * Every rule here is written so it cannot match the vendor: each one requires
 * the word `Harness`, the `-harness` suffix, or the scope's trailing slash.
 * No rule matches a bare `DeepSeek`.
 *
 * `Harness` stays. The fork owner reads it as the category noun this product
 * belongs to — the sense a lowercase `agent harness` already carries — so
 * `the Harness home` keeps its word while `~/.dsh` under it becomes `~/.lyn`.
 * The one exception is the compound `DeepSeekHarness`, an identifier naming the
 * product itself rather than the category.
 *
 * Rule order is load-bearing. `repo-url` runs before `slug` so a URL keeps its
 * owner segment, `pkg-scope` runs before `vendor-scope` so `dsh-tool-cordis`
 * is not read as a vendored package, and `env-prefix` runs before `dsh-token`
 * so `DSH_HOME` becomes `LYNESS_HOME` rather than `LYN_HOME`.
 *
 * Names live in paths as well as in text, and the two cannot diverge: config
 * and documentation reference workspace directories and Agent Notes by path,
 * so a content-only rename leaves `tsconfig.host.json` pointing at a directory
 * that does not exist and `AGENTS.md` linking a note that was never moved.
 * Every run therefore renames tracked paths under the same rules through
 * `git mv`. Agent Notes take part: protecting their text while rewriting the
 * links into them is what produces the dead links.
 *
 * Usage: `pnpm run rebrand [--apply|--check] [--reverse] [--only=<rule>]`.
 * Without a mode it reports what would change, per rule and per file kind.
 * `--only` applies one rule at a time, so a 28k-occurrence rename lands in
 * reviewable stages instead of one commit no reviewer can read.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')

/** The fork's GitHub owner and repository, which every upstream repo URL moves to. */
const REPOSITORY = 'XavierZhang/lyness'

/**
 * One rename, applied in array order as a plain literal substitution.
 *
 * `from` must be a string that can only ever mean the harness brand: the rules
 * carry no word boundaries, so a `from` that also occurs inside an unrelated
 * identifier would corrupt it. `dsh` and `Dsh` are the exceptions and carry an
 * explicit {@link Rule.boundary}.
 */
interface Rule {
  /** Stable id, used by `--only` and by the per-rule report. */
  readonly id: string
  /** Pre-rebrand text. */
  readonly from: string
  /** Post-rebrand text. */
  readonly to: string
  /** Why this rule cannot match the model vendor, or what it protects. */
  readonly note: string
  /**
   * Refuse the match when a lowercase letter sits on either side, so the token
   * is not cut out of a longer lowercase word. Set for the bare `dsh` token,
   * which `handshake` would otherwise corrupt. Case changes, underscores, and
   * hyphens all remain boundaries, so `dshHome`, `dsh_home`, and
   * `dsh-prose-standard` still rename — identifiers, skill ids, and preset ids
   * carry the brand too.
   */
  readonly boundary?: true
}

const RULES: readonly Rule[] = [
  {
    id: 'repo-url',
    from: 'github.com/deepseek-ai/deepseek-harness',
    to: `github.com/${REPOSITORY}`,
    note: 'Runs before `slug`, which would otherwise leave the upstream owner segment pointing at a repository that does not host this fork.',
  },
  {
    id: 'repo-url-org',
    from: 'github.com/deepseek-harness/deepseek-harness',
    to: `github.com/${REPOSITORY}`,
    note: 'The native landlock packages carry a second upstream owner spelling.',
  },
  {
    id: 'doc-anchor',
    from: 'deepseek-aidsh-',
    to: 'lynesslyn-',
    note: 'Markdown anchors in the generated catalogs drop the `@` and `/` from a package name, so `@deepseek-ai/dsh-acp` anchors as `deepseek-aidsh-acp` and the renamed `@lyness/lyn-acp` anchors as `lynesslyn-acp`. The generators rewrite their own headings; this rule carries the hand-written links that point at them.',
  },
  {
    id: 'pkg-scope-escaped',
    from: '@deepseek-ai\\/dsh-',
    to: '@lyness\\/lyn-',
    note: 'The package prefix as a REGEX literal writes its separator escaped, so the plain `pkg-scope` literal cannot see it. Stated explicitly rather than left to `scope-bare` plus `dsh-token`, so the escaped form does not depend on their relative order.',
  },
  {
    id: 'pkg-scope',
    from: '@deepseek-ai/dsh-',
    to: '@lyness/lyn-',
    note: 'The harness package prefix. The product segment is KEPT: upstream uses it to tell its own packages from the rescoped vendored ones, and every gate that classifies a package by name prefix depends on that distinction. Dropping it made `@lyness/agent` and `@lyness/cordis` indistinguishable and each such gate needed excluding by hand ([record](../.agents/notes/implemented/process/2026-09-12-restoring-the-product-name-segment.md)). Runs before `vendor-scope` so `dsh-tool-cordis` is not mistaken for a vendored package.',
  },
  {
    id: 'vendor-scope',
    from: '@deepseek-ai/',
    to: '@lyness/',
    note: 'The vendored Cordis layer, rescoped by `rescope-vendor` into the upstream scope; publishing the fork republishes it, so it follows the fork scope.',
  },
  {
    id: 'scope-bare',
    from: '@deepseek-ai',
    to: '@lyness',
    note: 'The npm organization named without a trailing slash, as prose and manifest tables spell it. Runs after the two slashed scope rules, which have already consumed every package reference.',
  },
  {
    id: 'compound-identifier',
    from: 'DeepSeekHarness',
    to: 'Lyness',
    note: 'The SDK product class and its companions (`DeepSeekHarnessConfig`, `createProcessDeepSeekHarness`). Carries no space, so `product-name` cannot reach it. The class is the product, so the redundant `Harness` segment drops.',
  },
  {
    id: 'product-name',
    from: 'DeepSeek Harness',
    to: 'lyness',
    note: 'Requires the word `Harness`, so it cannot match the model vendor.',
  },
  {
    id: 'punctuated-product-name',
    from: 'DeepSeek.Harness',
    to: 'Lyness',
    note: 'A deliberately odd spelling in a Python requirement fixture, which exists so the normalizer is exercised on separators the canonical name never uses. `product-name` requires a space and cannot see it.',
  },
  {
    id: 'fixture-unrelated-package',
    from: 'deepseek-unrelated',
    to: 'lyness-unrelated',
    note: 'A fabricated third-party package in the same fixture, named to share the local project prefix so the test proves a shared prefix alone does not exempt a dependency. It only keeps that meaning if it tracks the product name.',
  },
  {
    id: 'slug',
    from: 'deepseek-harness',
    to: 'lyness',
    note: 'Requires the `-harness` suffix, so it cannot match `deepseek-ai`, `llm-deepseek`, or `api.deepseek.com`.',
  },
  {
    id: 'env-prefix',
    from: 'DSH_',
    to: 'LYNESS_',
    note: 'Runs before `dsh-token`. The environment prefix keeps the full product name while the command and home directory shorten, which is the naming the fork owner chose.',
  },
  {
    id: 'abbreviation',
    from: 'DSH',
    to: 'LYN',
    note: 'The product abbreviation in prose, headings, and identifiers such as `DSHInspector`. Runs after `env-prefix` so `DSH_HOME` has already become `LYNESS_HOME` and cannot be reached here. Unbounded: no other all-caps word in this tree contains these three letters.',
  },
  {
    id: 'lowercase-env-prefix-probe',
    from: 'dsh_scrub_probe_lower',
    to: 'lyness_scrub_probe_lower',
    note: 'A deliberately lowercase environment name proving the scrubber matches its prefix case-insensitively. The prefix spells `lyness_` in lowercase, while the bare token spells `lyn`, so the generic token rule would name a variable the scrubber does not recognise and the test would assert nothing.',
  },
  {
    id: 'identifier',
    from: 'Dsh',
    to: 'Lyn',
    note: 'PascalCase occurrences inside identifiers such as `parseDshArgs`, so it is deliberately unbounded. Runs before `dsh-token` so the lowercase rule does not split a camelCase word.',
  },
  {
    id: 'escaped-newline-token',
    from: '\\ndsh',
    to: '\\nlyn',
    note: 'A fixture that stores a newline as the two characters `\\` and `n` puts an identifier character immediately before the token, so `dsh-token` refuses the match that keeps `handshake` intact. Recorded terminal output writes the shell prompt this way. Deliberately unbounded: the escape itself separates the token, and the character before the backslash is whatever the previous line ended with.',
  },
  {
    id: 'lowercased-config-key',
    from: 'dshunknown',
    to: 'lynunknown',
    note: 'Git lowercases configuration keys, so `extensions.dshUnknown` reaches a diagnostic as `dshunknown` and the token sits inside one lowercase word that `dsh-token` refuses to split. The key and the message must keep naming the same extension.',
  },
  {
    id: 'concatenated-label',
    from: 'Skilldsh-',
    to: 'Skilllyn-',
    note: 'An accessible name a component builds by concatenating its label and a skill id, so the assertion text carries `Skill` immediately before the id and `dsh-token` reads the token as part of one lowercase word. The rendered id follows the rename, so the expectation must too.',
  },
  {
    id: 'dsh-token',
    from: 'dsh',
    to: 'lyn',
    note: 'The CLI command, the `~/.dsh` home directory, the `dsh` package-manifest key and its property accesses, and the `dsh-*` skill and preset ids. Bounded so it cannot split an unrelated identifier.',
    boundary: true,
  },
]

/**
 * A path the generic pass does not rewrite, and which rules it is exempt from.
 *
 * Protection is per rule because a file can be authoritative for one name and
 * derived for another: `vendor/README.md` records the upstream repositories the
 * pinned source was copied from, so it must keep the upstream owner in a URL
 * while still following the scope rename that applies to every consumer.
 */
interface Protection {
  /** Path or path prefix, relative to the repository root. */
  readonly prefix: string
  /** Why this path is exempt. */
  readonly why: string
  /** Rule ids to skip here; omitted means the path skips every rule. */
  readonly rules?: readonly string[]
}

/**
 * Paths the generic pass does not rewrite, each with the reason.
 *
 * Frozen upstream history is the main entry: an Agent Note records what was
 * true when it was written, and rewriting it both falsifies the record and
 * guarantees a conflict on every upstream sync.
 */
const PROTECTED: readonly Protection[] = [
  {
    prefix: 'vendor/README.md',
    why: 'The vendoring manifest records which upstream repository and commit each pinned copy came from. Rewriting those URLs would claim the framework was vendored from this fork, which is false; the scope rename still applies because it names the published package, not the source.',
    rules: ['repo-url', 'repo-url-org', 'slug'],
  },
  {
    prefix: 'THIRD_PARTY_NOTICES.md',
    why: 'Generated from the vendored manifests, and its provenance column carries the same upstream source URLs vendor/README.md records. The scope rename still applies because that column names the published package.',
    rules: ['repo-url', 'repo-url-org', 'slug'],
  },
  { prefix: 'CUSTOM.md', why: 'The fork ledger names both the upstream and fork values on purpose; rewriting it erases the mapping it exists to record.' },
  { prefix: '.fork/', why: 'Fork configuration recording the upstream identity it forked from.' },
  {
    prefix: '.agents/notes/archived/',
    why: 'Archived Agent Notes are frozen: archived/manifest.json seals each artifact by content hash and only ever appends, so changed content is an error the tooling has no path to accept. The record states what was true when it was written.',
  },
  { prefix: 'python/sdk/uv.lock', why: 'Generated by `uv`, which rewrites it from the Python manifests.' },
  { prefix: 'pnpm-lock.yaml', why: 'Generated by `pnpm install`, which rewrites it from the manifests; it also records workspace DIRECTORY paths, which this codemod does not rename.' },
  { prefix: 'lyness-requirements.md', why: 'The fork requirements document, authored against upstream names.' },
  { prefix: 'scripts/rebrand.ts', why: 'This codemod: its own rules quote both sides of every rename.' },
  {
    prefix: '.agents/notes/implemented/process/2026-08-31-lyness-rebrand-codemod',
    why: 'The record of this rename. Quoting the upstream spelling is what it is for, so rewriting it turns every rule it documents into `X becomes X`.',
  },
  {
    prefix: '.agents/notes/implemented/process/2026-09-12-restoring-the-product-name-segment',
    why: 'Records why harness package names keep the product segment, which it can only state by naming both spellings.',
  },
]

/** A string that must appear exactly `count` times once the rebrand has run. */
interface PostCondition {
  readonly file: string
  readonly text: string
  readonly count: number
}

/**
 * Post-state assertions.
 *
 * The zero-count entries are the load-bearing ones: they assert that the model
 * vendor SURVIVED the rebrand. A rule that starts matching `api.deepseek.com`
 * or the `llm-deepseek` provider breaks the product's ability to call a model,
 * and would otherwise pass every type and lint gate.
 */
const POSTCONDITIONS: readonly PostCondition[] = [
  { file: 'apps/cli/package.json', text: '"lyn": "lib/bin.js"', count: 1 },
  // This pair IS the discriminator: a harness package carries the product
  // segment, a rescoped vendored one does not. Every gate that classifies a
  // package by name prefix reads that difference.
  { file: 'packages/llm/llm-deepseek/package.json', text: '"name": "@lyness/lyn-llm-deepseek"', count: 1 },
  { file: 'vendor/cordis/package.json', text: '"name": "@lyness/cordis"', count: 1 },
  // Vendoring provenance: the upstream repositories the pinned source was copied from.
  { file: 'vendor/README.md', text: 'github.com/deepseek-harness/cosmokit', count: 1 },
  { file: 'vendor/README.md', text: 'github.com/deepseek-harness/cordis', count: 5 },
  // The model vendor must be untouched wherever the product reaches it.
  { file: 'packages/bundle/base/cordis.patch.yml', text: 'api.deepseek.com', count: 0 },
  { file: 'CUSTOM.md', text: 'DeepSeek Harness', count: 3 },
]

/**
 * True when a tracked file holds bytes no text rename may touch.
 *
 * Detection reads the content rather than the extension: an allowlist of
 * extensions silently skips whatever it forgot, and the names this codemod
 * renames turn up in stylesheets, JSON Lines fixtures, web manifests, and a
 * dependency patch as readily as in TypeScript.
 *
 * The test is whether the whole file decodes as UTF-8, which is exactly the
 * condition under which rewriting round-trips losslessly. `git diff` instead
 * calls a file binary on a NUL byte in the first block; two source fixtures
 * embed a real NUL in a string literal, and that heuristic froze them at the
 * upstream name.
 * @param path - absolute path to the tracked file.
 * @returns Whether the file must be left byte-for-byte alone.
 */
function binary(path: string): boolean {
  // A gitlink entry lists as a tracked path but is a directory on disk.
  if (!statSync(path).isFile()) return true
  try {
    new TextDecoder('utf8', { fatal: true }).decode(readFileSync(path))
    return false
  } catch {
    // Swallows only TextDecoder's decode failure: bytes that are not UTF-8
    // cannot survive the string round-trip, so the file is left alone.
    return true
  }
}

/**
 * The rules a file is exempt from.
 * @param file - repository-relative path.
 * @returns Rule ids to skip, or `'all'` when the file is exempt from every rule.
 */
function protectedRules(file: string): 'all' | ReadonlySet<string> {
  const skip = new Set<string>()
  for (const entry of PROTECTED) {
    if (file !== entry.prefix && !file.startsWith(entry.prefix)) continue
    if (entry.rules === undefined) return 'all'
    for (const rule of entry.rules) skip.add(rule)
  }
  return skip
}

function excluded(file: string): boolean {
  if (protectedRules(file) === 'all') return true
  return binary(resolve(root, file))
}

/**
 * True when `character` continues a lowercase word, so a bounded rule must not
 * split it.
 *
 * Only a lowercase letter counts. Treating every identifier character as a
 * boundary was too strict: it protected `handshake` but also refused
 * `dshHome`, `dsh_home`, `__dsh_main__`, and `subagent_dsh_sdk`, all of which
 * carry the brand and must follow the rename. A digit does not continue a
 * word either — `\x07dsh` is an escape followed by the token.
 */
function lowercaseWordChar(character: string | undefined): boolean {
  return character !== undefined && /[a-z]/.test(character)
}

/**
 * Apply one rule to one line.
 *
 * A bounded rule matches only where neither neighbour is an identifier
 * character, which keeps `dsh` from splitting `dshoe` or `xdsh` while still
 * renaming `dsh-prose-standard` and `~/.dsh`.
 * @param line - the line to rewrite.
 * @param rule - the rule to apply, already oriented for the running direction.
 * @param from - the source text for the running direction.
 * @param to - the target text for the running direction.
 * @returns The rewritten line, or the original when the rule does not match.
 */
/**
 * A reference to a frozen archived Agent Note, whose file name never changes.
 *
 * Protecting the archived tree freezes those files but not the links that
 * reach them from documents this codemod does rewrite. An address is only
 * useful while it resolves, so it is frozen with what it addresses.
 */
const ARCHIVED_REFERENCE = /(?:\.agents\/notes\/)?archived\/[a-z-]+\/[^\s)\]`'"]+/g

/**
 * Apply one rule to a line, leaving references to archived Agent Notes intact.
 *
 * The rule runs over the segments between references rather than over a
 * sentinel-substituted copy: no character is reserved, so a line carrying any
 * byte sequence — a NUL in a test fixture included — rewrites correctly.
 * @param line - the line to rewrite.
 * @param rule - the rule to apply.
 * @param from - the source text for the running direction.
 * @param to - the target text for the running direction.
 * @returns The rewritten line, with archived references left verbatim.
 */
function applyPreservingArchivedReferences(line: string, rule: Rule, from: string, to: string): string {
  let out = ''
  let index = 0
  ARCHIVED_REFERENCE.lastIndex = 0
  for (let match = ARCHIVED_REFERENCE.exec(line); match !== null; match = ARCHIVED_REFERENCE.exec(line)) {
    out += applyRule(line.slice(index, match.index), rule, from, to) + match[0]
    index = match.index + match[0].length
  }
  return out + applyRule(line.slice(index), rule, from, to)
}

function applyRule(line: string, rule: Rule, from: string, to: string): string {
  if (rule.boundary !== true) return line.split(from).join(to)
  let out = ''
  let index = 0
  for (;;) {
    const hit = line.indexOf(from, index)
    if (hit < 0) return out + line.slice(index)
    const before = hit === 0 ? undefined : line[hit - 1]
    const after = line[hit + from.length]
    out += line.slice(index, hit) + (lowercaseWordChar(before) || lowercaseWordChar(after) ? from : to)
    index = hit + from.length
  }
}

/**
 * Rewrite one file's text under the selected rules.
 * @param text - the file's current content.
 * @param rules - the rules to apply, in order.
 * @param reverse - whether to run the rename backwards.
 * @param skip - rule ids this file is exempt from.
 * @returns The rewritten text and the per-rule count of lines each rule changed.
 */
export function rewrite(
  text: string, rules: readonly Rule[], reverse: boolean, skip: ReadonlySet<string> = new Set(),
): { text: string; hits: Map<string, number> } {
  const hits = new Map<string, number>()
  const out = text.split('\n').map((line) => {
    let current = line
    for (const rule of rules) {
      if (skip.has(rule.id)) continue
      const from = reverse ? rule.to : rule.from
      const to = reverse ? rule.from : rule.to
      const next = applyPreservingArchivedReferences(current, rule, from, to)
      if (next !== current) hits.set(rule.id, (hits.get(rule.id) ?? 0) + 1)
      current = next
    }
    return current
  })
  return { text: out.join('\n'), hits }
}

/**
 * The path a tracked file moves to under the rename rules.
 *
 * Rules apply to the whole path, not per segment: a directory name and the file
 * name under it obey the same rules, and no rule spans a separator.
 * @param file - repository-relative path.
 * @param rules - the rules to apply, in order.
 * @param reverse - whether to run the rename backwards.
 * @returns The renamed path, identical to `file` when no rule matches.
 */
export function renamePath(file: string, rules: readonly Rule[], reverse: boolean): string {
  const skip = protectedRules(file)
  if (skip === 'all') return file
  let out = file
  for (const rule of rules) {
    if (skip.has(rule.id)) continue
    out = applyRule(out, rule, reverse ? rule.to : rule.from, reverse ? rule.from : rule.to)
  }
  return out
}

function classify(file: string): string {
  if (file.endsWith('package.json')) return 'package manifests'
  if (/\.(ts|tsx|js|mjs|cjs|tpl)$/.test(file)) return 'code'
  if (/\.(yml|yaml)$/.test(file)) return 'YAML composition'
  if (file.endsWith('.py')) return 'Python SDK'
  if (file.endsWith('.json')) return 'JSON configuration'
  if (file.endsWith('.md')) return 'documentation'
  return 'scripts and manifests'
}

function main(): void {
  const args = process.argv.slice(2)
  const mode = args.includes('--apply') ? 'apply' : args.includes('--check') ? 'check' : 'dry'
  const reverse = args.includes('--reverse')
  const only = args.find(argument => argument.startsWith('--only='))?.slice('--only='.length)

  if (only !== undefined && !RULES.some(rule => rule.id === only)) {
    console.error(`rebrand: unknown rule ${JSON.stringify(only)}; known rules: ${RULES.map(rule => rule.id).join(', ')}`)
    process.exitCode = 1
    return
  }
  const rules = only === undefined ? RULES : RULES.filter(rule => rule.id === only)

  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => file !== '')
  // The content pass reads only the extensions it can rewrite; the path pass
  // covers every tracked file, because a name needs renaming whether or not
  // this codemod understands what is inside it.
  const files = tracked.filter(file => !excluded(file))
  const renameable = tracked.filter(file => protectedRules(file) !== 'all')

  const failures: string[] = []
  const outstanding: string[] = []
  const perRule = new Map<string, number>()
  const perKind = new Map<string, { files: number; lines: number }>()

  for (const file of files) {
    const path = resolve(root, file)
    const before = readFileSync(path, 'utf8')
    const skip = protectedRules(file)
    const { text: after, hits } = rewrite(before, rules, reverse, skip === 'all' ? new Set() : skip)
    if (after === before) continue
    outstanding.push(file)
    for (const [id, count] of hits) perRule.set(id, (perRule.get(id) ?? 0) + count)
    const kind = classify(file)
    const current = perKind.get(kind) ?? { files: 0, lines: 0 }
    perKind.set(kind, { files: current.files + 1, lines: current.lines + [...hits.values()].reduce((sum, count) => sum + count, 0) })
    if (mode === 'apply') writeFileSync(path, after)
  }

  // Paths move after the content pass so a failed content write never leaves a
  // half-renamed tree, and so `git mv` operates on files whose text is final.
  const moves: { from: string; to: string }[] = []
  for (const file of renameable) {
    const renamed = renamePath(file, rules, reverse)
    if (renamed !== file) moves.push({ from: file, to: renamed })
  }
  if (mode === 'apply') {
    for (const move of moves) {
      mkdirSync(resolve(root, dirname(move.to)), { recursive: true })
      execFileSync('git', ['mv', move.from, move.to], { cwd: root })
    }
  }

  const scope = only === undefined ? 'all rules' : `rule ${only}`
  console.log(`rebrand: ${mode}${reverse ? ' --reverse' : ''} over ${String(files.length)} tracked files (${scope})`)
  console.log('  by rule:')
  for (const rule of rules) {
    const count = perRule.get(rule.id) ?? 0
    console.log(`    ${rule.id.padEnd(14)} ${String(count).padStart(6)} line(s)   ${rule.from} → ${rule.to}`)
  }
  console.log(`  paths renamed: ${String(moves.length)}`)
  console.log('  by file kind:')
  for (const kind of [...perKind.keys()].sort()) {
    const { files: count, lines } = perKind.get(kind) ?? { files: 0, lines: 0 }
    console.log(`    ${kind.padEnd(20)} ${String(count).padStart(4)} file(s), ${String(lines)} line(s)`)
  }

  if (mode === 'check' && !reverse) {
    for (const file of outstanding) failures.push(`residue: ${file} still carries a pre-rebrand name`)
    for (const move of moves) failures.push(`residue: path ${move.from} was never renamed to ${move.to}`)
    for (const check of POSTCONDITIONS) {
      const path = resolve(root, check.file)
      const hits = existsSync(path) ? readFileSync(path, 'utf8').split(check.text).length - 1 : -1
      if (hits !== check.count) {
        failures.push(`postcondition: ${check.file} has ${String(hits)} occurrence(s) of ${JSON.stringify(check.text)}, expected ${String(check.count)}`)
      }
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`rebrand: ${failure}`)
    console.error(`rebrand: ${String(failures.length)} problem(s); the mapping or an upstream site moved.`)
    process.exitCode = 1
  } else if (mode === 'check') {
    console.log('rebrand: post-state verified — no residue, every postcondition holds, idempotent.')
  } else if (mode === 'apply') {
    console.log('rebrand: applied. Run `pnpm install`, then `pnpm run typecheck`, `pnpm run build`, and `pnpm run test:snapshot`.')
  }
}

// Importing this module for its exported rewriter must not run the codemod.
if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
