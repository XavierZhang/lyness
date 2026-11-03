/**
 * The memory section in Settings: what this deployment remembers about the
 * person reading it, and the one thing they can do about each entry.
 *
 * Read and remove, and no writing. A memory is written when a person asks
 * their agent to remember something, which is where the sentence they meant
 * belongs; a text field here would invite a fact nobody said in a
 * conversation and the log could not explain.
 */

import { useEffect } from 'react'
import { Button } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { createMemorySectionStore } from './store.ts'
import css from './MemorySection.module.css'

/** Injected business face: the read, the retry, and the removal. */
export interface MemorySectionInjected {
  /** Read what is remembered, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Remove one entry. */
  forget: (id: string) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type MemorySectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createMemorySectionStore>>
  & PropsLocale<'settings.memory'> & MemorySectionInjected

/**
 * Render the section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function MemorySection({ t, useStore, load, retry, forget }: MemorySectionProps) {
  const status = useStore(state => state.status)
  const entries = useStore(state => state.entries)
  const removing = useStore(state => state.removing)
  const refused = useStore(state => state.refused)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment a request.
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
      {status === 'unowned' ? <p className={css.notice}>{t('unowned')}</p> : null}
      {status === 'failed' ? (
        <div className={css.notice}>
          <p>{t('failed')}</p>
          <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      ) : null}
      {/* jscpd:ignore-end */}

      {status !== 'ready' ? null : (
        <>
          {entries.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
            <ul className={css.rows}>
              {entries.map(entry => (
                <li key={entry.id} className={css.row}>
                  <div className={css.rowMain}>
                    <p className={css.rowText}>{entry.text}</p>
                    <p className={css.rowWhen}>
                      {t('rememberedAt', { at: new Date(entry.writtenAt).toLocaleString() })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={removing !== undefined}
                    onClick={() => { void forget(entry.id) }}
                  >{removing === entry.id ? t('forgetting') : t('forget')}</Button>
                </li>
              ))}
            </ul>
          )}
          {refused === undefined
            ? null
            : <p className={`${css.outcome} ${css.refused}`}>{t('refused', { reason: refused })}</p>}
          <p className={css.outcome}>{t('sharedElsewhere')}</p>
        </>
      )}
    </div>
  )
}
