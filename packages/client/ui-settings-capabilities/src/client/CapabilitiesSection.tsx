/**
 * The "what you may use" section in Settings: the tools, connections, skills
 * and models this reader's agents actually have, each naming who gave it.
 *
 * Every row is read-only on purpose. In this product those four things are
 * composed by a deployment, so a control here would promise what the next
 * call refuses; naming the decider instead is the honest version of the same
 * page.
 */

import { useEffect } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { CapabilitySource, ToolPluginView } from '@deepseek-ai/dsh-api-agent-capabilities-controller/types'
import type { LocalizedText } from '@deepseek-ai/dsh-package-manifest'
import type { createCapabilitiesSectionStore } from './store.ts'
import css from './CapabilitiesSection.module.css'

/** Injected business face: the read, the retry, and local package text. */
export interface CapabilitiesSectionInjected {
  /** Read what is available, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Resolve a plugin's own title or description in the current Client locale. */
  resolveText: (text: LocalizedText) => string
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type CapabilitiesSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createCapabilitiesSectionStore>>
  & PropsLocale<'settings.capabilities'> & CapabilitiesSectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.capabilities'>['t']

/**
 * Name who made one capability available.
 * @param source - what the deployment answered.
 * @param t - the active translator.
 * @returns the text to show at the end of the row.
 */
function sourceLabel(source: CapabilitySource, t: Translate): string {
  return source === 'deployment' ? t('fromDeployment') : t('fromPreset')
}

/**
 * What one group of tools is called on a page for people.
 *
 * The plugin's own title when its package declares one, because that is the
 * sentence its author wrote for a reader; its display name otherwise, which
 * is still the name this product uses for it everywhere else.
 * @param group - one plugin's tools, as the Host projected them.
 * @param resolveText - resolves local package text in the current locale.
 * @returns the title and, when the package declares one, the description.
 */
function pluginText(
  group: ToolPluginView,
  resolveText: CapabilitiesSectionInjected['resolveText'],
): { readonly title: string; readonly description: string | undefined } {
  const title = group.meta?.title
  const description = group.meta?.description
  return {
    title: title === undefined ? group.plugin : resolveText(title) || group.plugin,
    description: description === undefined ? undefined : resolveText(description) || undefined,
  }
}

/**
 * Render the section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function CapabilitiesSection({ t, useStore, load, retry, resolveText }: CapabilitiesSectionProps) {
  const status = useStore(state => state.status)
  const capabilities = useStore(state => state.capabilities)
  const models = useStore(state => state.models)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment two requests.
  useEffect(() => { void load() }, [load])

  return (
    <div className={css.section}>
      {/* jscpd:ignore-start */}
      {/* The shape of a Settings section that reads from the deployment: a
          title, an intro, and one notice per state the read can be in. Each
          section owns its own copy and its own CSS module, so what repeats
          here is the shape rather than anything that could be shared. */}
      <header className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        <p className={css.intro}>{t('intro')}</p>
      </header>

      {status === 'loading' ? <p className={css.notice}>{t('loading')}</p> : null}
      {status === 'failed' ? (
        <div className={css.notice}>
          <p>{t('failed')}</p>
          <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      ) : null}
      {/* jscpd:ignore-end */}

      {status !== 'ready' || capabilities === undefined ? null : (
        <>
          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('models')}</h3>
            {models === undefined ? <p className={css.notice}>{t('modelsUnavailable')}</p> : (
              <ul className={css.rows}>
                {models.groups.map(group => (
                  <li key={group.id} className={css.row}>
                    <span className={css.rowName}>{group.name}</span>
                    <span className={css.rowDetail}>
                      {t('modelCount', { count: String(group.models.length) })}
                    </span>
                    <span className={css.rowSource}>{t('fromDeployment')}</span>
                  </li>
                ))}
              </ul>
            )}
            {models !== undefined && models.groups.length === 0
              ? <p className={css.notice}>{t('noModels')}</p>
              : null}
          </section>

          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('connections')}</h3>
            {capabilities.connections.length === 0 ? <p className={css.notice}>{t('noConnections')}</p> : (
              <ul className={css.rows}>
                {capabilities.connections.map(connection => (
                  <li key={connection.server} className={css.row}>
                    <span className={css.rowName}>{connection.server}</span>
                    <span className={css.rowDetail}>
                      {t('toolCount', { count: String(connection.tools) })}
                    </span>
                    <span className={css.rowSource}>{sourceLabel(connection.source, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('skills')}</h3>
            {capabilities.skills === undefined ? <p className={css.notice}>{t('skillsAbsent')}</p> : null}
            {capabilities.skills?.length === 0 ? <p className={css.notice}>{t('noSkills')}</p> : null}
            {capabilities.skills === undefined || capabilities.skills.length === 0 ? null : (
              <ul className={css.rows}>
                {capabilities.skills.map(skill => (
                  <li key={skill.name} className={css.row}>
                    <span className={css.rowName}>{skill.name}</span>
                    <span className={css.rowDetail}>{skill.description}</span>
                    <span className={css.rowSource}>
                      {t('fromSkillSource', { origin: skill.origin, provider: skill.provider })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('tools')}</h3>
            {capabilities.tools.length === 0 ? <p className={css.notice}>{t('noTools')}</p> : (
              <>
                <p className={css.notice}>
                  {t('toolSummary', {
                    count: String(capabilities.tools.reduce((total, group) => total + group.tools.length, 0)),
                    plugins: String(capabilities.tools.length),
                  })}
                </p>
                <ul className={css.rows}>
                  {/* One row per plugin, named the way its author named it. A
                      tool's own description is written for the model — English
                      prose about arguments and exit codes, which on this page
                      reads as code rather than as an answer — so what a row
                      carries is the plugin's own sentence and the tool names
                      a task shows. */}
                  {capabilities.tools.map((group) => {
                    const { title, description } = pluginText(group, resolveText)
                    return (
                      <li key={group.plugin} className={css.row}>
                        <span className={css.rowName}>{title}</span>
                        <span className={css.rowDetail}>
                          {description ?? t('toolCount', { count: String(group.tools.length) })}
                        </span>
                        <span className={css.rowSource}>{sourceLabel(group.source, t)}</span>
                        <span className={css.rowNames}>{group.tools.join(' · ')}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          <p className={css.intro}>
            {capabilities.preset === undefined
              ? t('readOnly')
              : t('readOnlyWithPreset', { preset: capabilities.preset })}
          </p>
        </>
      )}
    </div>
  )
}
