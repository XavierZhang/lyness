/**
 * Wire vocabulary of the read-only "what you may use" surface.
 * @module @deepseek-ai/dsh-api-agent-capabilities-controller/types
 */

import type { PluginLocalizedMeta } from '@deepseek-ai/dsh-package-manifest'

/** Who decided that one capability is available. */
export type CapabilitySource =
  /** The deployment composed it, so every agent of this installation has it. */
  | 'deployment'
  /** The agent preset this reader's conversations run added it. */
  | 'preset'

/**
 * One plugin whose tools a reader's agents may call.
 *
 * A plugin rather than a tool, because a tool is a name written for a model:
 * five of them belong to one capability a person recognizes, and the plugin
 * that registered them is what that capability is called. Each tool's own
 * description is left out on purpose — it is model-facing prose about
 * arguments and exit codes, which on a page for people reads as code.
 */
export interface ToolPluginView {
  /** The registering plugin's display name, which a surface shows when the package declares no title. */
  readonly plugin: string
  /** That package's own localized title, description and icon, when this deployment can read them. */
  readonly meta?: PluginLocalizedMeta
  /** The model-facing names it registered, in name order, so a reader recognizes a tool named in a task. */
  readonly tools: readonly string[]
  /** Who made it available. */
  readonly source: CapabilitySource
}

/** One MCP server whose tools a reader's agents may call. */
export interface ConnectionAvailabilityView {
  /** The server name its tools are namespaced under. */
  readonly server: string
  /** How many of its tools are currently available. */
  readonly tools: number
  /** Who made it available. */
  readonly source: CapabilitySource
}

/** One skill a reader's agents may invoke. */
export interface SkillAvailabilityView {
  /** The skill's addressable name. */
  readonly name: string
  /** Its routing description. */
  readonly description: string
  /** The discovery source that produced it, as the registry reports it. */
  readonly origin: string
  /** The provider that owns its body, as the registry reports it. */
  readonly provider: string
}

/** What one reader's agents may use, and who decided each part of it. */
export interface AgentCapabilitiesView {
  /** The preset this reader's conversations run, when the deployment names one. */
  readonly preset?: string
  /** Tools other than an MCP server's, grouped by the plugin that registered them. */
  readonly tools: readonly ToolPluginView[]
  /** MCP servers, each with how many of its tools are available. */
  readonly connections: readonly ConnectionAvailabilityView[]
  /**
   * Skills the registry currently discovers; absent when this deployment
   * mounts no skill registry, which is different from discovering none.
   */
  readonly skills?: readonly SkillAvailabilityView[]
}
