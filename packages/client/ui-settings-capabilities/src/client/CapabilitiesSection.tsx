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
import { Button } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { CapabilitySource } from '@lyness/lyn-api-agent-capabilities-controller/types'
import type { createCapabilitiesSectionStore } from './store.ts'
import css from './CapabilitiesSection.module.css'

/** Injected business face: the read and the retry. */
export interface CapabilitiesSectionInjected {
  /** Read what is available, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
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
 * Render the section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function CapabilitiesSection({ t, useStore, load, retry }: CapabilitiesSectionProps) {
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
              <ul className={css.rows}>
                {capabilities.tools.map(tool => (
                  <li key={tool.name} className={css.row}>
                    <span className={css.rowName}>{tool.name}</span>
                    <span className={css.rowDetail}>{tool.description}</span>
                    <span className={css.rowSource}>{sourceLabel(tool.source, t)}</span>
                  </li>
                ))}
              </ul>
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
