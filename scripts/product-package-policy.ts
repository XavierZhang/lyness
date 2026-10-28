/** Non-default package roles retained outside the experimental group. */

/** Product role that does not require a default runtime mount. */
export type ProductPackageCategory = 'optional' | 'sdk' | 'build' | 'test' | 'web-distribution' | 'declarations'

/** One explicitly maintained package role and its reason. */
export interface ProductPackagePolicy {
  /** Why this package remains outside the experimental group. */
  readonly reason: string
  /** The supported product role checked against its directory. */
  readonly category: ProductPackageCategory
}

/**
 * Exceptions to default runtime reachability, keyed by repository-relative package directory.
 * Optional integrations may be reached by an optional bundle without becoming default capabilities.
 */
export const PRODUCT_PACKAGE_POLICY: Readonly<Record<string, ProductPackagePolicy>> = {
  'packages/browser-use/browser-use': { category: 'optional', reason: 'Service definition used by explicitly selected browser providers.' },
  'packages/computer-use/computer-use': { category: 'optional', reason: 'Service definition used by explicitly selected computer providers.' },
  'packages/lsp/lsp': { category: 'optional', reason: 'Service definition for deployment-configured language servers.' },
  'packages/lsp/lsp-stdio': { category: 'optional', reason: 'Requires an explicit server list and language-server executables.' },
  'packages/lsp/tool-lsp': { category: 'optional', reason: 'Model tools selected together with a configured LSP provider.' },
  'packages/ssh/ssh': { category: 'optional', reason: 'Explicit remote connection and helper configuration.' },
  'packages/ssh/ssh-helper-runtime': { category: 'optional', reason: 'Private executable carrier for explicitly configured SSH connections.' },
  'packages/ssh/fs-ssh': { category: 'optional', reason: 'Remote filesystem provider selected in an SSH composition.' },
  'packages/ssh/sandbox-ssh': { category: 'optional', reason: 'Remote confinement provider selected in an SSH composition.' },
  'packages/ssh/subprocess-ssh': { category: 'optional', reason: 'Remote process provider selected in an SSH composition.' },
  'packages/storage/storage-sqlite': { category: 'optional', reason: 'Persistent storage requires an explicit database path and backend selection.' },
  'packages/subagent/subagent-acp': { category: 'optional', reason: 'Requires a configured external ACP agent command.' },
  'packages/subagent/subagent-claude-code': { category: 'optional', reason: 'Separately installed native Claude Code agent integration.' },
  'packages/subagent/subagent-codex': { category: 'optional', reason: 'Separately installed native Codex agent integration.' },
  'packages/subagent/subagent-lyn-sdk': { category: 'optional', reason: 'Requires an explicitly configured external LYN home.' },
  'packages/web/web-search-exa': { category: 'optional', reason: 'Alternative search provider requiring its own API credentials.' },
  'packages/web/web-search-perplexity': { category: 'optional', reason: 'Alternative search provider requiring its own API credentials.' },
  'packages/context/tmux-context': { category: 'optional', reason: 'Context contribution requiring a tmux pane.' },
  'packages/fs/tool-str-replace-editor': { category: 'optional', reason: 'Explicit alternative to the default filesystem editing tools.' },
  'packages/sdk/client': { category: 'sdk', reason: 'Published TypeScript embedding client runs in the consumer process.' },
  'packages/typert/generator': { category: 'build', reason: 'Build-time generation of type metadata.' },
  'packages/test-support/agent-loop-testkit': { category: 'test', reason: 'Published agent-loop test harness.' },
  'packages/test-support/tool-testkit': { category: 'test', reason: 'Shared tool definition and execution fixtures for tests and benchmarks.' },
  'packages/test-support/client-runtime': { category: 'test', reason: 'Published browser plugin test harness.' },
  'packages/test-support/llm-mock-server': { category: 'test', reason: 'Published model-provider test server.' },
  'packages/test-support/llm-replay': { category: 'test', reason: 'Published recorded-model replay harness.' },
  'packages/test-support/loader-smoke': { category: 'test', reason: 'Published plugin Loader smoke-test harness.' },
  'packages/test-support/remote-mock': { category: 'test', reason: 'Published typed Remote test proxies.' },
  'packages/test-support/session-snapshot': { category: 'test', reason: 'Published Session snapshot replay harness.' },
  'packages/test-support/e2e-target': { category: 'test', reason: 'Shared end-to-end target fixtures for real-API suites.' },
  'packages/client/web': { category: 'web-distribution', reason: 'Browser boot kernel bundled into the Web distribution.' },
  'packages/client/ui-dockkit': { category: 'web-distribution', reason: 'Layout library bundled into the Web distribution.' },
  'packages/util/package-manifest': { category: 'declarations', reason: 'Shared package metadata declarations have no runtime mount.' },

  // The multi-tenancy seam. A deployment that serves one customer mounts none
  // of it, and absent is the only version of "single tenant" that no later
  // patch layer can switch on
  // ([seam](../.agents/notes/implemented/architecture/2026-09-17-tenant-directory-seam.md)).
  'packages/tenant/tenant': { category: 'optional', reason: 'Tenant directory selected by a deployment serving more than one customer; unmounted means single-tenant.' },
  'packages/tenant/tenant-static': { category: 'optional', reason: 'Composition-listed tenant directory, selected instead of the HTTP provider.' },
  'packages/tenant/tenant-http': { category: 'optional', reason: 'Tenant directory read over HTTP, selected instead of the composition-listed provider.' },
  'packages/tenant/tenant-config': { category: 'optional', reason: 'Per-tenant configuration seam mounted only where tenants exist.' },
  'packages/tenant/tenant-config-static': { category: 'optional', reason: 'Read-only tenant configuration backend, selected instead of the store.' },
  'packages/tenant/tenant-config-store': { category: 'optional', reason: 'Durable tenant configuration backend, selected instead of the read-only one.' },
  'packages/tenant/tenant-request': { category: 'optional', reason: 'Resolves the calling tenant per request; only a multi-tenant deployment has one to resolve.' },
  'packages/tenant/tenant-session': { category: 'optional', reason: 'Stamps the tenant into a new Session log; nothing to stamp on a single-tenant deployment.' },
  'packages/api/tenant-controller': { category: 'optional', reason: 'Tenant configuration Remote namespace, mounted with the tenancy seam.' },

  // Built and tested, composed by a deployment rather than shipped on.
  'packages/vendor/microsoft-entra': { category: 'optional', reason: 'Sign-in channel kind selected by a deployment that uses Entra as its directory.' },
  'packages/api/desktop-link': { category: 'optional', reason: 'Desktop pairing Remote namespace, mounted only by a desktop composition.' },
  'packages/fs/fs-desktop': { category: 'optional', reason: 'Filesystem provider backed by the paired desktop, selected instead of a local or SSH provider.' },
  'packages/client/ui-brand-official': { category: 'optional', reason: "Upstream's brand occupant, retained for merges; this installation's own brand package fills the slot." },

  // The webhook module ships both its rows disabled: the GitHub adapter has
  // four required fields, one of them a credential reference, so no shipped
  // value would be right, and an enabled adapter is authenticated public HTTP
  // ingress that creates root Sessions.
  'packages/webhook/webhook': { category: 'optional', reason: 'Webhook ingress ships disabled; a route and its rules are a deployment decision.' },
  'packages/webhook/webhook-github': { category: 'optional', reason: 'GitHub adapter ships disabled; it requires a shared-secret credential reference no default can supply.' },
}
