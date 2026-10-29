/**
 * The instructions section in Settings: what this person tells their own
 * agents, and the editor that changes it.
 *
 * The draft is the component's, and the saved text is the store's. They are
 * separate because they answer different questions: what the person is
 * typing, and what their next conversation will actually carry. The section
 * says which of the two is in force rather than letting an unsaved draft read
 * as a setting.
 */

import { useEffect, useState } from 'react'
import { Button } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { createInstructionsSectionStore } from './store.ts'
import css from './InstructionsSection.module.css'

/** Injected business face: the read, the retry, and the save. */
export interface InstructionsSectionInjected {
  /** Read what is saved, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Replace what is saved; blank clears it. */
  save: (text: string) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type InstructionsSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createInstructionsSectionStore>>
  & PropsLocale<'settings.instructions'> & InstructionsSectionInjected

/**
 * Render the section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function InstructionsSection({ t, useStore, load, retry, save }: InstructionsSectionProps) {
  const status = useStore(state => state.status)
  const saved = useStore(state => state.saved)
  const writtenAt = useStore(state => state.writtenAt)
  const maxChars = useStore(state => state.maxChars)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)
  const [draft, setDraft] = useState<string | undefined>(undefined)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  // The draft follows what the deployment answered until the person types.
  // Resetting it on every answer would discard what they were writing while a
  // save landed; leaving it forever would hide what the deployment now holds.
  const text = draft ?? saved
  const over = maxChars > 0 && text.length > maxChars
  const dirty = text !== saved

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
        <div className={css.editor}>
          <textarea
            className={css.field}
            aria-label={t('title')}
            placeholder={t('placeholder')}
            value={text}
            disabled={working}
            onChange={(event) => { setDraft(event.target.value) }}
          />
          <div className={css.footer}>
            <p className={`${css.counter}${over ? ` ${css.over}` : ''}`}>
              {t('counter', { used: String(text.length), max: String(maxChars) })}
            </p>
            <div className={css.actions}>
              <Button
                variant="outline"
                disabled={working || text === ''}
                onClick={() => { setDraft(''); void save('') }}
              >{t('clear')}</Button>
              <Button
                disabled={working || over || !dirty}
                onClick={() => { void save(text) }}
              >{t('save')}</Button>
            </div>
          </div>
          {outcome?.kind === 'refused'
            ? <p className={`${css.outcome} ${css.refused}`}>{t('refused', { reason: outcome.reason })}</p>
            : null}
          {outcome?.kind === 'saved' && !dirty
            ? <p className={css.outcome}>{t('savedNotice')}</p>
            : null}
          {dirty ? <p className={css.outcome}>{t('unsaved')}</p> : null}
          {!dirty && writtenAt !== undefined
            ? <p className={css.outcome}>{t('lastSaved', { at: new Date(writtenAt).toLocaleString() })}</p>
            : null}
          <p className={css.outcome}>{t('appliesToNew')}</p>
        </div>
      )}
    </div>
  )
}
