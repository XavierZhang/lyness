/**
 * A plugin's English name is a name, and it says as much as its Chinese one.
 *
 * `locale/<locale>.json` `meta` is what every surface showing a plugin calls
 * it: the plugin list, the plugin market, and the capabilities page. The
 * Chinese, Japanese and European files carry real titles and sentences, while
 * the English file was left holding the package slug — `tool-fs`, `memory`,
 * `api-gateway` — and, for most packages, no description at all. An English
 * reader then met an identifier where every other reader met a name.
 *
 * So this gate asks two things of `locale/en.json`: that its `title` reads as
 * a name rather than as a module specifier, and that it declares every `meta`
 * field its `locale/zh.json` declares. A package whose English name genuinely
 * is one lowercase token lists itself in {@link SLUG_TITLES}.
 * @module scripts/verify-plugin-meta-copy
 */

import { existsSync, globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Repository root, resolved from this script's own location. */
const root = resolve(import.meta.dirname, '..')

/** The `meta` fields an English file must carry whenever the Chinese one does. */
const PAIRED_FIELDS = ['title', 'description'] as const

/**
 * Packages whose English title is one lowercase token on purpose, by
 * `<group>/<package>`.
 *
 * Only a name that is written that way everywhere belongs here — a product or
 * protocol spelled in lower case — never a package slug standing in for a name.
 */
const SLUG_TITLES: ReadonlySet<string> = new Set([])

/** A title that is a module specifier or a package slug rather than a name. */
const SLUG_TITLE = /^@?[a-z0-9]+(?:[-./@][a-z0-9]+)*$/u

/** One plugin's localized `meta`, as the file declares it. */
interface PluginMeta {
  readonly title?: unknown
  readonly description?: unknown
  readonly icon?: unknown
}

/**
 * Read one locale file's `meta`.
 * @param path - absolute path of the locale file.
 * @returns its `meta` object, or undefined when the file declares none.
 */
function metaOf(path: string): PluginMeta | undefined {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || !('meta' in parsed)) return undefined
  const { meta } = parsed
  return typeof meta === 'object' && meta !== null ? meta : undefined
}

/**
 * Whether one English title reads as a slug rather than as a name.
 * @param title - the declared English title.
 * @returns true when it is a single lowercase token, dots and dashes included.
 */
export function slugTitle(title: string): boolean {
  return SLUG_TITLE.test(title)
}

/**
 * Report every English plugin `meta` that reads as a slug or says less than its Chinese counterpart.
 * @param repository - repository root to scan.
 * @returns one diagnostic per problem, plus any stale exemption.
 */
export function pluginMetaProblems(repository: string = root): readonly string[] {
  const files = globSync('packages/*/*/locale/en.json', { cwd: repository }).sort()
  if (files.length === 0) return [`${repository}: no plugin locale files found`]
  const problems: string[] = []
  const scanned = new Set<string>()
  const slugged = new Set<string>()
  for (const relativePath of files) {
    const file = relativePath.replaceAll('\\', '/')
    const pkg = file.split('/').slice(1, 3).join('/')
    scanned.add(pkg)
    const english = metaOf(resolve(repository, file))
    if (english === undefined) {
      problems.push(`${file}: declares no meta; a package's locale file names the plugin`)
      continue
    }
    const title = english.title
    if (typeof title !== 'string' || title === '') {
      problems.push(`${file}: declares no meta.title`)
    } else if (slugTitle(title)) {
      slugged.add(pkg)
      if (!SLUG_TITLES.has(pkg)) {
        problems.push(`${file}: meta.title ${JSON.stringify(title)} is a package slug, not a name an English reader can read`)
      }
    }
    const chinesePath = resolve(repository, file.replace('/en.json', '/zh.json'))
    if (!existsSync(chinesePath)) continue
    const chinese = metaOf(chinesePath)
    for (const field of PAIRED_FIELDS) {
      if (chinese?.[field] === undefined || english[field] !== undefined) continue
      problems.push(`${file}: meta.${field} is missing, and locale/zh.json declares one`)
    }
  }
  // Only against packages this scan read: a run over a fixture tree holds
  // none of them, and absence there says nothing about the exemption.
  for (const pkg of SLUG_TITLES) {
    if (!scanned.has(pkg) || slugged.has(pkg)) continue
    problems.push(`${pkg}: exempted, but its English title is already a name — drop the exemption`)
  }
  return problems
}

if (import.meta.main) {
  const problems = pluginMetaProblems()
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) {
    console.error(
      'verify-plugin-meta-copy: write the English title and description the way the Chinese file writes them, '
      + 'or add the package to SLUG_TITLES when its name genuinely is one lowercase token.',
    )
    process.exitCode = 1
  } else {
    console.log('verify-plugin-meta-copy: every plugin names itself in English as fully as in Chinese.')
  }
}
