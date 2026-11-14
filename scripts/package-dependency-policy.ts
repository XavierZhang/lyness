/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `lyn.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `lyn.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@lyness/lyn-api-session-controller',
  '@lyness/lyn-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@lyness/lyn-llm',
  '@lyness/lyn-session',
]

/** Required Cordis services whose Host imports are type-only. */
const REQUIRED_SERVICE_PEERS = {
  '@lyness/lyn-api-terminal-controller': ['@lyness/lyn-subprocess'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@lyness/lyn-client-locale': ['@lyness/lyn-api-remotes'],
  '@lyness/lyn-client-ui-conversation': [
    '@lyness/lyn-api-remotes',
    '@lyness/lyn-client-ui-workspace',
  ],
  '@lyness/lyn-client-ui-model-selection': ['@lyness/lyn-client-ui-input-trigger'],
  '@lyness/lyn-client-ui-sidebar': ['@lyness/lyn-client-ui-workspace'],
  '@lyness/lyn-client-ui-subagent': ['@lyness/lyn-client-ui-input-trigger'],
  '@lyness/lyn-client-ui-theme': ['@lyness/lyn-api-remotes'],
  '@lyness/lyn-client-ui-tool': ['@lyness/lyn-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@lyness/lyn-brand',
  '@lyness/lyn-lazy-require',
  '@lyness/lyn-typert-protocol',
  '@lyness/lyn-util-code-language',
  '@lyness/lyn-util-crypto',
  '@lyness/lyn-util-text-search',
  '@lyness/lyn-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@lyness/lyn-atomic-write': ['withFileLock', 'writeFileAtomic'],
  '@lyness/lyn-deque': ['Deque'],
  // Builds a dispatcher from the resolved proxy policy; the caller owns and closes it.
  '@lyness/lyn-http-proxy': ['createRouteDispatcher'],
  // The Liveshare wire codec and identity helpers are stateless functions over caller-owned values.
  '@lyness/lyn-experimental-liveshare-protocol': [
    'LIVESHARE_CAPABILITIES', 'LIVESHARE_PROTOCOL_VERSION', 'parseRelayFrame', 'parseShareAccessState',
    'parseTunnelWorkerCommand', 'parseTunnelWorkerEvent', 'rawText', 'sendFrame', 'unsupportedFrameRefusal',
    'viewerRequestFields', 'identityFromKey', 'identityKeyOf',
  ],
  // The shipped profile templates are plain data; a consumer reads their bundle names only.
  '@lyness/lyn-official-bundles': ['PROFILE_TEMPLATES'],
  // Messages and assembled blocks are plain data. Each caller owns its assembler.
  '@lyness/lyn-llm': ['BlockAssembler', 'callConfigEquals', 'createUserMessage'],
  '@lyness/lyn-session-format': ['sessionFormatLogFilename'],
  '@lyness/lyn-storage-domain': ['defineDomain'],
  '@lyness/lyn-timeout': ['MAX_TIMER_DELAY_MS'],
  // Both operate only on the caller's subprocess service and handle; the module memoizes only the binary path.
  '@lyness/lyn-util-ripgrep': ['readRipgrepLines', 'spawnRipgrep'],
  '@lyness/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  // Profile settings must match the installed Node provider's configuration schema.
  '@lyness/lyn-ptc-runtime-node/configuration': ['resolvePersistentExecution'],
  // CUA mounts the installed provider and shares executor error classes with PTC.
  '@lyness/lyn-ptc-runtime-node': ['default'],
  '@lyness/lyn-tool-executor-ptc/run-code': ['RunCodeConfig', 'createRunCodeTool'],
  // CUA checks UserQuestionError and preserves AttachmentError from image admission; longEdgeDimensions is pure
  // arithmetic that rides the same peer.
  '@lyness/lyn-attachment': ['admitEncodedImages', 'longEdgeDimensions'],
  '@lyness/lyn-user-questions': ['UserQuestionError'],
  // The tool registry and every subclass rely on `instanceof` against one HarnessError class.
  '@lyness/lyn-error': ['HarnessError'],
  // `instanceof` checks need the translator's own class instance.
  '@lyness/lyn-experimental-translator': ['TranslationError'],
  // Stateless; a safe classification would turn the forge panel's forge and worktree peers into dependencies.
  '@lyness/lyn-experimental-forge': ['changeRequestKey'],
  '@lyness/lyn-experimental-worktree': ['generatedWorktreeName', 'CREATED_RECORD', 'createdWorktreeSchema'],
  // The forge panel matches ctx.fs failures with `instanceof FsError`.
  '@lyness/lyn-fs': ['FsError'],
  '@lyness/lyn-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeParentOf', 'scopeTarget'],
  // appendPluginRecord writes through the Session class's private log; pluginRecordOf is stateless.
  // The DeepSeek chat importer validates its seed with the installed Session class before storing it.
  '@lyness/lyn-session': ['SESSION_FORMAT_VERSION', 'Session', 'appendPluginRecord', 'pluginRecordOf'],
  '@lyness/lyn-session-persistence': ['SessionPersistenceNotFoundError'],
  // Imported titles follow the installed title service's normalization.
  '@lyness/lyn-session-title': ['normalizeSessionTitle'],
  // Error classes have instance identity; CUA and Liveshare throw the registry's own copy so `instanceof` against it matches.
  '@lyness/lyn-tools': ['defineTool', 'ToolArgsError', 'ToolContextUnavailableError'],
  // Readers recognize a deadline's TimeoutReason only by `instanceof` against their own copy.
  '@lyness/lyn-timeout': ['deadline', 'timeoutOf'],
  // Imported web tool results must render exactly like the installed web tools' results and cards.
  '@lyness/lyn-tool-web': ['fetchMetaFromValue', 'formatFetchOutput', 'formatSearchOutput', 'searchMetaFromValue'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly requiredServicePeers?: Readonly<Record<string, readonly string[]>>
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  requiredServicePeers: REQUIRED_SERVICE_PEERS,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(lynField: unknown): boolean {
  return isRecord(lynField) && Object.hasOwn(lynField, 'client')
}
