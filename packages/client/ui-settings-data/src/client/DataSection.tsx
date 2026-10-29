/**
 * The data section in Settings: the conversations this person has, each with
 * the two things they own — a copy of it, and its removal.
 *
 * It lists the same conversations the sidebar lists, from the same catalog,
 * so a row here and a row there can never disagree about what exists. What
 * the deletion does not take is stated rather than left to be assumed: the
 * logs go, and an uploaded file's stored bytes are addressed by content and
 * may belong to another conversation too.
 */

import { Button } from '@lyness/lyn-client-ui-primitives'
import type { ObservableSnapshot } from '@lyness/lyn-client-store'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { ConversationRow } from './rows.ts'
import type { createDataSectionStore } from './store.ts'
import css from './DataSection.module.css'

/** Injected business face: the rows, the confirmation, and the two controls. */
export interface DataSectionInjected {
  /** Observable sources the framework turns into `useXxx` props. */
  hooks: {
    /** The conversations this person can open, newest first. */
    conversations: ObservableSnapshot<readonly ConversationRow[]>
    /** Whether this deployment mounts the download this page offers. */
    exportAvailable: ObservableSnapshot<boolean>
  }
  /** Ask about one conversation before deleting it. */
  confirm: (id: string) => void
  /** Drop the question. */
  cancel: () => void
  /** Delete one conversation. */
  remove: (id: string) => Promise<void>
  /** Start one conversation's download. */
  exportConversation: (id: string) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type DataSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createDataSectionStore>>
  & PropsLocale<'settings.data'> & InjectFace<DataSectionInjected>

/**
 * Render the section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function DataSection({
  t, useStore, useConversations, useExportAvailable, confirm, cancel, remove, exportConversation,
}: DataSectionProps) {
  const conversations = useConversations(value => value)
  const exportAvailable = useExportAvailable(value => value)
  const confirming = useStore(state => state.confirming)
  const deleting = useStore(state => state.deleting)
  const refused = useStore(state => state.refused)
  const removed = useStore(state => state.removed)

  return (
    <div className={css.section}>
      {/* jscpd:ignore-start */}
      {/* The shape of a Settings section: a title and an intro. Each section
          owns its own copy and its own CSS module, so what repeats here is
          the shape rather than anything that could be shared. */}
      <header className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        <p className={css.intro}>{t('intro')}</p>
      </header>
      {/* jscpd:ignore-end */}

      {conversations.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
        <ul className={css.rows}>
          {conversations.map(row => (
            <li key={row.id} className={css.row}>
              <div className={css.rowMain}>
                <p className={css.rowTitle}>{row.title}</p>
                <p className={css.rowWhen}>{t('lastActive', { at: new Date(row.updatedAt).toLocaleString() })}</p>
              </div>
              {!exportAvailable ? null : (
                <Button
                  variant="outline"
                  disabled={deleting !== undefined}
                  onClick={() => { exportConversation(row.id) }}
                >{t('export')}</Button>
              )}
              {confirming === row.id ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { void remove(row.id) }}
                  >{t('deleteConfirm')}</Button>
                  <Button variant="ghost" onClick={() => { cancel() }}>{t('deleteCancel')}</Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  disabled={deleting !== undefined}
                  onClick={() => { confirm(row.id) }}
                >{deleting === row.id ? t('deleting') : t('delete')}</Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming === undefined ? null : <p className={css.outcome}>{t('deleteWarning')}</p>}
      {refused === undefined ? null : <p className={`${css.outcome} ${css.refused}`}>{t('refused', { reason: refused })}</p>}
      {removed === undefined ? null : <p className={css.outcome}>{t('removed', { count: String(removed) })}</p>}
      <p className={css.outcome}>{t('keeps')}</p>
      {exportAvailable ? null : <p className={css.outcome}>{t('noExport')}</p>}
    </div>
  )
}
