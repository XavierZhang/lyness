/** The package names the plugin manager protects, hides, orders, or marks experimental. */

/**
 * Plugin packages the plugin manager refuses to disable or remove, because management itself needs them; a bundle that
 * contains one is read-only as well. Removing a name drops only this `management-required` refusal; the manager's own
 * entry, installation-carried bundles, and unaddressable rows stay protected by their own rules.
 */
export const PROTECTED_PLUGINS: ReadonlySet<string> = new Set([
  '@lyness/lyn-plugin-manager', '@lyness/cordis-plugin-loader',
  '@lyness/cordis-plugin-include', '@lyness/lyn-api-gateway',
  '@lyness/lyn-host-webserver', '@lyness/lyn-client-modules',
  '@lyness/lyn-client-ui-settings-plugin-inventory', '@lyness/lyn-client-ui-plugin-manager',
  '@lyness/lyn-host-plugin-inventory', '@lyness/lyn-typert-registry',
  '@lyness/lyn-api-remotes', '@lyness/lyn-api-remote-access',
  '@lyness/cordis-plugin-timer', '@lyness/lyn-client-connection',
  '@lyness/lyn-host-frontend-static', '@lyness/lyn-tools',
  '@lyness/lyn-hmr',
])

/**
 * Built-in profile bundles and persistent terminals, which have no plugin manager page.
 * Their Host availability and activation stay intact.
 */
export const HIDDEN_BUNDLES: ReadonlySet<string> = new Set([
  '@lyness/lyn-base',
  '@lyness/lyn-web-app',
  '@lyness/lyn-headless',
  '@lyness/lyn-sdk-app',
  '@lyness/lyn-acp-app',
  '@lyness/lyn-sdk-minimal',
  '@lyness/lyn-experimental-terminal-bundle',
])

/**
 * The optional bundles the plugin manager's main and More lists rank first, in this order. {@link MORE_BUNDLES}, not
 * this list, decides whether a bundle appears on the main list.
 */
export const EXTENSION_BUNDLES: readonly string[] = [
  '@lyness/lyn-experimental-agent-team-profile',
  '@lyness/lyn-experimental-voice-input-bundle',
  '@lyness/lyn-experimental-plugin-market-bundle',
  '@lyness/lyn-experimental-auto-review',
]

/**
 * The optional bundles the plugin manager's main list leaves out until the profile enables them; its More list,
 * which includes every eligible bundle, ranks them last in this order.
 */
export const MORE_BUNDLES: readonly string[] = [
  '@lyness/lyn-personalized-recommendations',
  '@lyness/lyn-experimental-inspector-profile',
  '@lyness/lyn-cua-bundle',
  '@lyness/lyn-experimental-tool-worktree',
  '@lyness/lyn-experimental-cot-translation-bundle',
  '@lyness/lyn-experimental-session-search',
  '@lyness/lyn-experimental-session-titles-bundle',
  '@lyness/lyn-experimental-badge-skill-bundle',
  '@lyness/lyn-experimental-ralph-bundle',
  '@lyness/lyn-subagent-codex',
  '@lyness/lyn-subagent-claude-code',
]

/** Official bundles the plugin manager marks with the Experimental badge. */
export const EXPERIMENTAL_BUNDLES: ReadonlySet<string> = new Set([
  '@lyness/lyn-personalized-recommendations',
  '@lyness/lyn-cua-bundle',
  '@lyness/lyn-experimental-agent-team-profile',
  '@lyness/lyn-experimental-voice-input-bundle',
  '@lyness/lyn-experimental-auto-review',
  '@lyness/lyn-experimental-inspector-profile',
  '@lyness/lyn-experimental-tool-worktree',
  '@lyness/lyn-experimental-cot-translation-bundle',
  '@lyness/lyn-experimental-session-search',
  '@lyness/lyn-experimental-session-titles-bundle',
  '@lyness/lyn-experimental-badge-skill-bundle',
  '@lyness/lyn-experimental-ralph-bundle',
  '@lyness/lyn-experimental-plugin-market-bundle',
])
