/**
 * The announcements row in General Settings, and the reader it opens.
 *
 * The row sits beside the current-version row on purpose: a reader looking for
 * what changed and a reader looking for which version they are on are the same
 * reader, and the version a release note names is the one the deployment has
 * claimed.
 */

import { useCallback, useMemo, useState } from 'react'
import { Button, MarkdownText, Modal } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { Announcement } from '@lyness/lyn-announcements/types'
import type { createAnnouncementsRowStore } from './settings-store.ts'
import css from './AnnouncementsRow.module.css'

/** Injected business face: the read and the retry. */
export interface AnnouncementsRowInjected {
  /** Read the announcements, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AnnouncementsRowProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAnnouncementsRowStore>>
  & PropsLocale<'settings.announcements'> & AnnouncementsRowInjected

/**
 * Render one announcement: its date, the release it names, and its body.
 * @param props - the announcement and the active translator.
 * @returns the announcement element tree.
 */
function AnnouncementEntry({ announcement, t }: {
  announcement: Announcement
  t: PropsLocale<'settings.announcements'>['t']
}) {
  const labels = useMemo(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
  }), [t])
  return (
    <article className={css.entry}>
      <header className={css.entryHeader}>
        <h3 className={css.entryTitle}>{announcement.title}</h3>
        <div className={css.entryMeta}>
          <time dateTime={announcement.publishedAt}>
            {new Date(announcement.publishedAt).toLocaleDateString()}
          </time>
          {announcement.version === undefined ? null : (
            <span className={css.version}>{t('releaseLabel', { version: announcement.version })}</span>
          )}
        </div>
      </header>
      <MarkdownText text={announcement.body} labels={labels} />
      {announcement.url === undefined ? null : (
        <a className={css.more} href={announcement.url} target="_blank" rel="noreferrer">{t('readMore')}</a>
      )}
    </article>
  )
}

/**
 * Render the row, and the reader while it is open.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AnnouncementsRow({ t, useStore, load, retry }: AnnouncementsRowProps) {
  const status = useStore(state => state.status)
  const announcements = useStore(state => state.announcements)
  const [open, setOpen] = useState(false)
  const latest = announcements[0]

  const show = useCallback((): void => {
    setOpen(true)
    // The read starts with the reader rather than with the row: a deployment
    // with nothing to say is the ordinary case, and a reader who never opens
    // this should not cost a request.
    void load()
  }, [load])

  return (
    <div className={css.row}>
      <div className={css.label}>
        <span>{t('row')}</span>
        {latest === undefined ? null : <span className={css.latest}>{t('latest', { title: latest.title })}</span>}
      </div>
      <Button variant="outline" onClick={show}>{t('open')}</Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false) }}
        title={t('title')}
        closeLabel={t('close')}
      >
        {status === 'loading' ? <p className={css.notice}>{t('loading')}</p> : null}
        {status === 'failed' ? (
          <div className={css.notice}>
            <p>{t('failed')}</p>
            <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
          </div>
        ) : null}
        {status === 'ready' && announcements.length === 0 ? <p className={css.notice}>{t('empty')}</p> : null}
        {announcements.map(announcement => (
          <AnnouncementEntry key={announcement.id} announcement={announcement} t={t} />
        ))}
      </Modal>
    </div>
  )
}
