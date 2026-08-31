/**
 * Rebrand the harness from DeepSeek Harness to lyness, and undo that rebrand
 * with `--reverse`. The fork publishes under its own identity, so every name
 * the upstream product owns — npm scope, CLI command, home directory,
 * environment prefix, display name, repository URL — moves to the fork's.
 *
 * This codemod follows [`rescope-vendor.ts`](./rescope-vendor.ts): ordered
 * literal rules, a protected-path list, an exact-edit list with required hit
 * counts, and a `--check` mode that asserts the post-state. An upstream change
 * to a listed site fails the run instead of being silently skipped, which is
 * what makes the rebrand re-appliable after every upstream sync.
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
 * Usage: `pnpm run rebrand [--apply|--check] [--reverse] [--only=<rule>]`.
 * Without a mode it reports what would change, per rule and per file kind.
 * `--only` applies one rule at a time, so a 28k-occurrence rename lands in
 * reviewable stages instead of one commit no reviewer can read.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
   * Require a non-identifier character on both sides. Set for the bare `dsh`
   * and `Dsh` tokens, which occur inside longer identifiers this rule must not
   * touch. A hyphen is NOT an identifier character, so `dsh-prose-standard`
   * still renames — skill and preset ids carry the brand too.
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
    id: 'pkg-scope',
    from: '@deepseek-ai/dsh-',
    to: '@lyness/',
    note: 'The harness package prefix. The scope already carries the product name, so the redundant `dsh-` segment drops. Runs before `vendor-scope` so `dsh-tool-cordis` is not mistaken for a vendored package.',
  },
  {
    id: 'vendor-scope',
    from: '@deepseek-ai/',
    to: '@lyness/',
    note: 'The vendored Cordis layer, rescoped by `rescope-vendor` into the upstream scope; publishing the fork republishes it, so it follows the fork scope.',
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
    note: 'The product abbreviation in prose and headings, which upstream docs recommend for naming. Runs after `env-prefix` so `DSH_HOME` has already become `LYNESS_HOME` and cannot be reached here.',
    boundary: true,
  },
  {
    id: 'identifier',
    from: 'Dsh',
    to: 'Lyn',
    note: 'PascalCase occurrences inside identifiers such as `parseDshArgs`, so it is deliberately unbounded. Runs before `dsh-token` so the lowercase rule does not split a camelCase word.',
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
 * Paths the generic pass never rewrites, each with the reason.
 *
 * Frozen upstream history is the main entry: an Agent Note records what was
 * true when it was written, and rewriting it both falsifies the record and
 * guarantees a conflict on every upstream sync.
 */
const PROTECTED: readonly { readonly prefix: string; readonly why: string }[] = [
  { prefix: '.agents/notes/', why: 'Frozen upstream Agent Notes — a record of what was true when written; rewriting them falsifies the record and conflicts on every sync.' },
  { prefix: 'vendor/', why: 'Pinned upstream source with its own sync procedure; `rescope-vendor` owns the names here.' },
  { prefix: 'CUSTOM.md', why: 'The fork ledger names both the upstream and fork values on purpose; rewriting it erases the mapping it exists to record.' },
  { prefix: '.fork/', why: 'Fork configuration recording the upstream identity it forked from.' },
  { prefix: 'lyness-requirements.md', why: 'The fork requirements document, authored against upstream names.' },
  { prefix: 'scripts/rebrand.ts', why: 'This codemod: its own rules quote both sides of every rename.' },
  { prefix: 'scripts/rescope-vendor.ts', why: 'Owns the vendor scope mapping and quotes upstream names as data.' },
  { prefix: 'docs/rescope.md', why: 'The vendor name-mapping table, which must keep both columns.' },
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
  { file: 'packages/llm/llm-deepseek/package.json', text: '"name": "@lyness/llm-deepseek"', count: 1 },
  // The model vendor must be untouched wherever the product reaches it.
  { file: 'packages/bundle/base/cordis.patch.yml', text: 'api.deepseek.com', count: 0 },
  { file: 'CUSTOM.md', text: 'DeepSeek Harness', count: 3 },
]

/** Files whose extension the generic pass reads; anything else is binary or generated. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.tpl', '.json', '.yml', '.yaml', '.md', '.py', '.toml', '.sh', '.ps1'] as const

function excluded(file: string): boolean {
  if (PROTECTED.some(entry => file === entry.prefix || file.startsWith(entry.prefix))) return true
  return !EXTENSIONS.some(extension => file.endsWith(extension))
}

/** True when `character` can occur inside an identifier, so a bounded rule must not match across it. */
function identifierChar(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character)
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
function applyRule(line: string, rule: Rule, from: string, to: string): string {
  if (rule.boundary !== true) return line.split(from).join(to)
  let out = ''
  let index = 0
  for (;;) {
    const hit = line.indexOf(from, index)
    if (hit < 0) return out + line.slice(index)
    const before = hit === 0 ? undefined : line[hit - 1]
    const after = line[hit + from.length]
    out += line.slice(index, hit) + (identifierChar(before) || identifierChar(after) ? from : to)
    index = hit + from.length
  }
}

/**
 * Rewrite one file's text under the selected rules.
 * @param text - the file's current content.
 * @param rules - the rules to apply, in order.
 * @param reverse - whether to run the rename backwards.
 * @returns The rewritten text and the per-rule count of lines each rule changed.
 */
export function rewrite(text: string, rules: readonly Rule[], reverse: boolean): { text: string; hits: Map<string, number> } {
  const hits = new Map<string, number>()
  const out = text.split('\n').map((line) => {
    let current = line
    for (const rule of rules) {
      const from = reverse ? rule.to : rule.from
      const to = reverse ? rule.from : rule.to
      const next = applyRule(current, rule, from, to)
      if (next !== current) hits.set(rule.id, (hits.get(rule.id) ?? 0) + 1)
      current = next
    }
    return current
  })
  return { text: out.join('\n'), hits }
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

  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => file !== '' && !excluded(file))

  const failures: string[] = []
  const outstanding: string[] = []
  const perRule = new Map<string, number>()
  const perKind = new Map<string, { files: number; lines: number }>()

  for (const file of files) {
    const path = resolve(root, file)
    const before = readFileSync(path, 'utf8')
    const { text: after, hits } = rewrite(before, rules, reverse)
    if (after === before) continue
    outstanding.push(file)
    for (const [id, count] of hits) perRule.set(id, (perRule.get(id) ?? 0) + count)
    const kind = classify(file)
    const current = perKind.get(kind) ?? { files: 0, lines: 0 }
    perKind.set(kind, { files: current.files + 1, lines: current.lines + [...hits.values()].reduce((sum, count) => sum + count, 0) })
    if (mode === 'apply') writeFileSync(path, after)
  }

  const scope = only === undefined ? 'all rules' : `rule ${only}`
  console.log(`rebrand: ${mode}${reverse ? ' --reverse' : ''} over ${String(files.length)} tracked files (${scope})`)
  console.log('  by rule:')
  for (const rule of rules) {
    const count = perRule.get(rule.id) ?? 0
    console.log(`    ${rule.id.padEnd(14)} ${String(count).padStart(6)} line(s)   ${rule.from} → ${rule.to}`)
  }
  console.log('  by file kind:')
  for (const kind of [...perKind.keys()].sort()) {
    const { files: count, lines } = perKind.get(kind) ?? { files: 0, lines: 0 }
    console.log(`    ${kind.padEnd(20)} ${String(count).padStart(4)} file(s), ${String(lines)} line(s)`)
  }

  if (mode === 'check' && !reverse) {
    for (const file of outstanding) failures.push(`residue: ${file} still carries a pre-rebrand name`)
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
