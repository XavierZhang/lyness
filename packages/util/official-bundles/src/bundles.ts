/** The bundle package names the dsh installation selects, offers, installs on demand, or retires. */

/** Installation-owned defaults used when a shipped profile is first opened. */
export interface ProfileTemplate {
  /** Ordered bundle layer list. */
  bundles: readonly string[]
  /**
   * Whether this profile serves several customers from one runtime.
   *
   * A hosted profile runs no user code: it mounts no execution provider and
   * no execution tool, so a prompt cannot reach the machine the Host runs on.
   * That is the boundary standing in for per-organization isolation until an
   * organization gets a process
   * ([decision](../../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md)),
   * and `verify-hosted-profile-boundary` holds the shipped profile to it.
   */
  hosted?: boolean
}

/**
 * The shipped profile templates auto-initialized on first use, by name.
 *
 * Changing a template's bundle list leaves every profile already on disk
 * holding the old one: a profile records what it was created with, and
 * nothing rewrites a list its owner may have edited. Record the superseded
 * list in {@link INSTALLATION_OWNED_PROFILE_TUPLES} in the same change, so a
 * profile still holding exactly what this product shipped follows the move
 * and one that was edited by hand keeps what its owner wrote.
 */
export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  acp: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-acp-app'],
  },
  web: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-web-execution', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal',
      '@deepseek-ai/dsh-module-webhook'],
  },
  /**
   * The enterprise shape: one customer's own servers, their own staff. It adds
   * model governance to the web surface and selects neither tenancy nor
   * credits — on this shape those subsystems are absent rather than disabled,
   * which is the only version of "no quota" that cannot leak a balance into a
   * surface, a log, or an error message.
   *
   * It selects accounts, because a customer's own staff are named people who
   * sign in through the customer's own directory, and because their
   * administrator configures that directory at runtime rather than asking
   * whoever deployed it to edit a composition file. Like the hosted template,
   * it does not boot until the deployment names its people
   * ([handbook](../../../../docs/user/guide/standalone-administration.md)).
   */
  enterprise: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-web-execution', '@deepseek-ai/dsh-module-accounts', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-model-governance',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal', '@deepseek-ai/dsh-module-webhook'],
  },
  /**
   * The hosted shape: DeepSeek Harness's own servers, many customers. It selects the
   * control plane — accounts, credits, model governance, sessions — and
   * selects no execution bundle, so the runtime executes nothing on behalf of
   * anyone. Agent work that touches a machine runs on the person's own, and
   * cloud execution waits for an organization to get a process.
   *
   * It does not boot until the deployment names its people: the accounts
   * module ships no roster, because a default one would be this template
   * deciding who administers somebody else's installation.
   *
   * Runtime self-modification is absent for the same reason the execution
   * bundle is: on a shared runtime it would let one customer rewrite the
   * deployment's composition.
   */
  hosted: {
    hosted: true,
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-accounts',
      '@deepseek-ai/dsh-module-credits', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-model-governance',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-webhook'],
  },
  headless: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-headless'],
  },
  sdk: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-sdk-app'],
  },
  'sdk-minimal': {
    bundles: ['@deepseek-ai/dsh-sdk-minimal'],
  },
  'brand-studio': {
    bundles: ['@deepseek-ai/dsh-brand-studio'],
  },
  'brand-setup': {
    bundles: ['@deepseek-ai/dsh-brand-setup'],
  },
}

/**
 * Bundle tuples the installation has shipped for a profile, normalized to its
 * current template.
 *
 * Each entry is a complete previous tuple, not a prefix: only an exact match
 * is normalized, so a list anybody edited by hand is left alone. A profile
 * that has sat through several default-module releases matches whichever
 * tuple it stopped at, which is why this holds every previous one rather than
 * only the latest.
 */
export const INSTALLATION_OWNED_PROFILE_TUPLES: Record<string, readonly (readonly string[])[]> = {
  acp: [
    // Before execution became its own bundle.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-acp-app'],
  ],
  sdk: [
    // Before execution became its own bundle.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-sdk-app'],
  ],
  headless: [
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-headless'],
    // Before execution became its own bundle. Also the list a profile that
    // spells it the pre-rescope way is rewritten from, rather than being left
    // depending on its legacy links.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'],
  ],
  web: [
    // Before any default module became its own bundle. A profile spelling this
    // the pre-rescope way reaches it through `rescopedBundleName`.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
    // After scheduled follow-ups, before durable memory.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-schedule'],
    // After durable memory, before the persistent terminal.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule'],
    // After the persistent terminal, before code navigation.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-memory',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal'],
    // After code navigation, before turn deliverables.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-lsp',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal'],
    // After turn deliverables, before runtime self-modification.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-lsp', '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule',
      '@deepseek-ai/dsh-module-terminal'],
    // After runtime self-modification, before webhook ingress.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp', '@deepseek-ai/dsh-module-memory',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal'],
    // After webhook ingress, before execution became its own bundle.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-deliverables',
      '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp', '@deepseek-ai/dsh-module-memory',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal', '@deepseek-ai/dsh-module-webhook'],
    // After execution became its own bundle, before the Web execution plane
    // moved into one. A profile left on this list keeps the shell, filesystem,
    // workflow and ralph rows on the host plane while its presets mount their
    // own, which is the collision both planes exist to prevent.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal',
      '@deepseek-ai/dsh-module-webhook'],
  ],
  enterprise: [
    // The shape as first shipped: before it served named people, and before
    // the Web execution plane moved into its own bundle.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-module-execution', '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-extensions', '@deepseek-ai/dsh-module-lsp',
      '@deepseek-ai/dsh-module-memory', '@deepseek-ai/dsh-module-model-governance',
      '@deepseek-ai/dsh-module-schedule', '@deepseek-ai/dsh-module-terminal', '@deepseek-ai/dsh-module-webhook'],
  ],
  hosted: [
    // Before the ledger became its own bundle, when the accounts module
    // carried it. A profile left on this list meters nobody.
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-module-accounts',
      '@deepseek-ai/dsh-module-deliverables', '@deepseek-ai/dsh-module-memory',
      '@deepseek-ai/dsh-module-model-governance', '@deepseek-ai/dsh-module-schedule',
      '@deepseek-ai/dsh-module-webhook'],
  ],
}

/** Bundles an earlier release shipped and the installation no longer carries; app-boot removes them from profiles. */
export const RETIRED_BUNDLES: ReadonlySet<string> = new Set([
  // The Web composition mounts Schedule itself
  // ([upgrade guide](../../../../docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md)).
  '@deepseek-ai/dsh-experimental-schedule-bundle',
])

/** The bundle list a `dsh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@deepseek-ai/dsh-base']

/**
 * The bundles the dsh installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `dsh.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager except persistent
 * terminals, which have no page switch
 * ([rationale](../../../../.agents/notes/implemented/process/2026-09-15-shipped-optional-bundles.md),
 * [admission](../../../../.agents/notes/implemented/architecture/2026-09-21-experimental-capabilities-as-optional-bundles.md)).
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@deepseek-ai/dsh-personalized-recommendations',
  '@deepseek-ai/dsh-cua-bundle',
  '@deepseek-ai/dsh-experimental-session-search',
  '@deepseek-ai/dsh-experimental-ralph-bundle',
  '@deepseek-ai/dsh-experimental-terminal-bundle',
  '@deepseek-ai/dsh-experimental-badge-skill-bundle',
  '@deepseek-ai/dsh-experimental-session-titles-bundle',
  '@deepseek-ai/dsh-experimental-agent-team-profile',
  '@deepseek-ai/dsh-experimental-voice-input-bundle',
  '@deepseek-ai/dsh-experimental-cot-translation-bundle',
  '@deepseek-ai/dsh-experimental-auto-review',
  '@deepseek-ai/dsh-experimental-inspector-profile',
  '@deepseek-ai/dsh-experimental-plugin-market-bundle',
  '@deepseek-ai/dsh-experimental-tool-worktree',
]

/** Public DSH release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@deepseek-ai/dsh-subagent-claude-code',
  '@deepseek-ai/dsh-subagent-codex',
]
