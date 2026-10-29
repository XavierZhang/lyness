/**
 * Wire vocabulary of the read-only "what you may use" surface.
 * @module @lyness/lyn-api-agent-capabilities-controller/types
 */

/** Who decided that one capability is available. */
export type CapabilitySource =
  /** The deployment composed it, so every agent of this installation has it. */
  | 'deployment'
  /** The agent preset this reader's conversations run added it. */
  | 'preset'

/** One tool a reader's agents may call. */
export interface ToolAvailabilityView {
  /** The tool's model-facing name. */
  readonly name: string
  /** Its one-line description, as the model reads it. */
  readonly description: string
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
  /** Tools other than an MCP server's, by name. */
  readonly tools: readonly ToolAvailabilityView[]
  /** MCP servers, each with how many of its tools are available. */
  readonly connections: readonly ConnectionAvailabilityView[]
  /**
   * Skills the registry currently discovers; absent when this deployment
   * mounts no skill registry, which is different from discovering none.
   */
  readonly skills?: readonly SkillAvailabilityView[]
}
