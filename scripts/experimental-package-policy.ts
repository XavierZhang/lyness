/** Experimental package identities, publication policy, and retained npm names. */

/**
 * Experimental packages whose npm names omit the experimental prefix, by directory: identities retained across
 * experimental classification and package-role moves, and packages named without the prefix so that leaving
 * experimental status keeps their names.
 */
export const EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS: Readonly<Record<string, string>> = {
  'packages/experimental/cua': '@lyness/lyn-cua',
  'packages/experimental/cua-bundle': '@lyness/lyn-cua-bundle',
  'packages/experimental/tool-session-query': '@lyness/lyn-tool-session-query',
  'packages/experimental/session-title-all-prompts-llm': '@lyness/lyn-session-title-all-prompts-llm',
  'packages/experimental/tool-terminal': '@lyness/lyn-tool-terminal',
  'packages/experimental/tool-ralph': '@lyness/lyn-tool-ralph',
  'packages/experimental/skill-badge': '@lyness/lyn-skill-badge',
  'packages/experimental/hook-protocol': '@lyness/lyn-hook-protocol',
  'packages/experimental/hooks-claude-code': '@lyness/lyn-hooks-claude-code',
  'packages/experimental/hooks-codex': '@lyness/lyn-hooks-codex',
  'packages/experimental/webhook': '@lyness/lyn-webhook',
  'packages/experimental/webhook-github': '@lyness/lyn-webhook-github',
  'packages/experimental/action-cards': '@lyness/lyn-action-cards',
  'packages/experimental/client-ui-action-cards': '@lyness/lyn-client-ui-action-cards',
  'packages/experimental/creation-recommendations': '@lyness/lyn-creation-recommendations',
  'packages/experimental/client-ui-creation-recommendations': '@lyness/lyn-client-ui-creation-recommendations',
  'packages/experimental/plugin-recommendations': '@lyness/lyn-plugin-recommendations',
  'packages/experimental/client-ui-plugin-recommendations': '@lyness/lyn-client-ui-plugin-recommendations',
  'packages/experimental/personalized-recommendations': '@lyness/lyn-personalized-recommendations',
} satisfies Record<`packages/experimental/${string}`, `@lyness/lyn-${string}`>

/** npm namespace for experimental packages without retained-name exceptions. */
export const EXPERIMENTAL_PACKAGE_NAME_PREFIX = '@lyness/lyn-experimental-'
const retainedNames = new Set(Object.values(EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS))

/**
 * Identify an experimental npm package independently of its installed directory.
 * @param name - complete npm package name, without a version or subpath.
 * @returns Whether the name uses the experimental prefix or a retained name.
 */
export function isExperimentalPackageName(name: string): boolean {
  return name.startsWith(EXPERIMENTAL_PACKAGE_NAME_PREFIX) || retainedNames.has(name)
}

/**
 * Find experimental identities in module ids, paths, subpaths, or npm alias specifications.
 * @param reference - package reference or bundler/runtime module identifier.
 * @returns Whether a delimited package name identifies an experimental capability.
 */
export function hasExperimentalPackageReference(reference: string): boolean {
  const normalized = reference.replaceAll('\\', '/')
  return [...normalized.matchAll(/(?:^|[/:\u0000])(@lyness\/[^/@?#:\s]+)(?=$|[/@?#:])/g)]
    .some(([, name]) => name !== undefined && isExperimentalPackageName(name))
}

/**
 * Derive the package-owned plugin record namespace without changing persisted names.
 * @param name - complete experimental npm package name.
 * @returns Capability suffix, or undefined for a non-experimental name.
 */
export function experimentalPackageRecordNamespace(name: string): string | undefined {
  if (!isExperimentalPackageName(name)) return undefined
  return name.slice(name.startsWith(EXPERIMENTAL_PACKAGE_NAME_PREFIX) ? EXPERIMENTAL_PACKAGE_NAME_PREFIX.length : '@lyness/lyn-'.length)
}

/** Experimental packages excluded from public releases and npm baselines. */
export const PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES: readonly string[] = []

/**
 * Whether an experimental package publishes under the default-public policy.
 * @param directory - repository-relative package directory.
 * @param privateDirectories - experimental directories excluded from publication.
 * @returns Whether the package publishes with the lyn family.
 */
export function isPublicExperimentalPackageDirectory(
  directory: string,
  privateDirectories: readonly string[] = PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES,
): boolean {
  return /^packages\/experimental\/[^/]+$/.test(directory)
    && !privateDirectories.includes(directory)
}
