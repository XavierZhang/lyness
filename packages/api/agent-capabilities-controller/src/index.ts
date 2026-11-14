/**
 * Host Remote owner of the `agentCapabilities` namespace: what one reader's
 * agents may use, and who decided each part of it.
 *
 * Every answer is projected from the registries an agent itself reads, at the
 * moment it is asked. It keeps no list of its own, because a list kept here
 * would be a second answer about capabilities and would disagree with what
 * the agents actually have the first time a composition changed.
 *
 * Models are not here. `session.modelCatalog` already answers which models
 * this deployment routes, and a surface showing them twice would invite the
 * two answers to drift.
 *
 * @module @deepseek-ai/dsh-api-agent-capabilities-controller
 */

import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RegisteredTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-skill'
import { connectionsOf, toolsOf } from './project.ts'
import type { ToolOrigin } from './project.ts'
import type { AgentCapabilitiesView, SkillAvailabilityView } from './types.ts'

export type * from './types.ts'
export type { ToolOrigin } from './project.ts'
export { MCP_TOOL_PREFIX, connectionsOf, serverOfToolName, toolsOf } from './project.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `agentCapabilities` Remote namespace. */
    agentCapabilitiesController: AgentCapabilitiesController
  }
}

/**
 * The composition entry that mounted one Fiber.
 *
 * A plugin mounted by another plugin carries no entry of its own, so the walk
 * climbs to the nearest ancestor that has one: a tool registered inside a
 * package belongs to the entry that package was composed as.
 * @param fiber - the registering Fiber.
 * @returns its entry, or undefined when no Loader mounted it.
 */
function entryOf(fiber: Fiber): Fiber['entry'] {
  let current = fiber
  for (;;) {
    if (current.entry !== undefined) return current.entry
    const parent = current.parent.fiber
    if (parent === current) return undefined
    current = parent
  }
}

/** Host service backing the generated `ctx.remote.agentCapabilities` namespace. */
export default class AgentCapabilitiesController extends TypertRemoteService {
  static inject = ['tools']

  /**
   * Register the namespace.
   * @param ctx - Host context carrying the tool registry; the preset and skill
   * registries are optional and read through `ctx.get`.
   */
  constructor(ctx: Context) {
    super(ctx, 'agentCapabilitiesController', { namespace: 'agentCapabilities', requires: 'member' })
  }

  /**
   * Describe what this reader's agents may use.
   *
   * The preset's own scope is acquired for the read and released after it, so
   * what is reported is the view an agent of that preset would see rather
   * than the deployment's bare registrations. A deployment that mounts no
   * preset registry reports the deployment view, which is the only one it has.
   * @returns the tools, connections and skills available, each naming who gave it.
   */
  @Remote
  async describe(): Promise<AgentCapabilitiesView> {
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) return this.viewOf(undefined, undefined)
    const scope = await presets.acquireScope()
    try {
      return await this.viewOf(scope.key, presets.defaultId)
    } finally {
      // The lease is a revision retain: releasing it is what lets the preset
      // generation be collected, so it is released even when the read throws.
      await scope[Symbol.asyncDispose]()
    }
  }

  /**
   * Project one scope's registries.
   * @param scope - the preset scope to read, or undefined for the deployment view.
   * @param preset - the preset's identity, when one was acquired.
   * @returns the view this namespace answers.
   */
  private async viewOf(scope: Parameters<typeof this.ctx.tools.definitions>[0], preset: string | undefined):
  Promise<AgentCapabilitiesView> {
    const deployment = this.ctx.tools.registered()
    const available: readonly RegisteredTool[] = scope === undefined
      ? deployment
      : this.ctx.tools.registered(scope)
    const fromDeployment = new Set(deployment.map(one => one.definition.name))
    return {
      ...preset === undefined ? {} : { preset },
      tools: toolsOf(available.map(one => this.originOf(one)), fromDeployment),
      connections: connectionsOf(available.map(one => one.definition), fromDeployment),
      ...await this.skillsOf(scope),
    }
  }

  /**
   * Where one tool comes from, as far as this deployment can tell.
   *
   * The registry answers with the Fiber that registered the tool; the Loader
   * answers which composition entry mounted that Fiber, and the package
   * service reads that package's own title and description. A deployment that
   * composes its plugins in code rather than from a file has no entry, and the
   * row falls back to the plugin's display name — which is what the registry
   * knows in every composition.
   * @param one - one visible tool with its registering Fiber.
   * @returns the row the projection groups by.
   */
  private originOf(one: RegisteredTool): ToolOrigin {
    const entry = entryOf(one.registrar)
    const base = entry?.parent.tree.ctx.baseUrl
    const meta = entry === undefined || base === undefined
      ? undefined
      : this.ctx.get('pluginPackages')?.metaOf(entry.options.name, base)
    return {
      name: one.definition.name,
      plugin: one.registrar.name,
      ...entry === undefined ? {} : { module: entry.options.name },
      ...meta === undefined ? {} : { meta },
    }
  }

  /**
   * Project the skills the registry currently discovers.
   *
   * A deployment that mounts no registry reports no `skills` member at all,
   * which a surface reads as "this installation has no skills" rather than as
   * "it discovered none".
   * @param scope - the preset scope whose layers to view.
   * @returns the member to spread into the view.
   */
  private async skillsOf(scope: Parameters<typeof this.ctx.tools.definitions>[0]):
  Promise<{ skills?: readonly SkillAvailabilityView[] }> {
    const registry = this.ctx.get('skills')
    if (registry === undefined) return {}
    const listed = await registry.list(scope === undefined ? {} : { scope })
    return {
      skills: listed.map((skill): SkillAvailabilityView => ({
        name: skill.name,
        description: skill.description,
        origin: skill.source,
        provider: skill.provider,
      })),
    }
  }
}
