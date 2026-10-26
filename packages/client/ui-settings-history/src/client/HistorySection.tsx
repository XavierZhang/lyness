/**
 * The history section in Settings: what administrators changed, who changed
 * it, and what the change replaced.
 *
 * Read-only by construction. The trail is append-only on the server, and a
 * surface offering to edit or delete an entry would be offering something the
 * deployment refuses — so this section shows and refreshes, and does nothing
 * else.
 */

import { useEffect } from 'react'
import { Button, Tag } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { AuditChangeView, AuditEntryView } from '@lyness/lyn-api-admin-audit-controller/types'
import type { createHistorySectionStore } from './store.ts'
import css from './HistorySection.module.css'

/** Injected business face: the read, the retry and the continuation. */
export interface HistorySectionInjected {
  /** Read the trail, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Read the entries older than one already shown. */
  loadMore: (before: string) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type HistorySectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createHistorySectionStore>>
  & PropsLocale<'settings.history'> & HistorySectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.history'>['t']

/**
 * What one kind of record is called.
 *
 * A kind this build does not know is shown as the server named it: the set is
 * open, so a later owner of administrable records reads as itself here rather
 * than as a blank.
 * @param kind - the kind as the wire names it.
 * @param t - the translator.
 * @returns the reader's label for it.
 */
export function kindLabel(kind: string, t: Translate): string {
  if (kind === 'person') return t('kindPerson')
  if (kind === 'binding') return t('kindBinding')
  if (kind === 'bot') return t('kindBot')
  if (kind === 'team') return t('kindTeam')
  if (kind === 'sign-in-channel') return t('kindSignInChannel')
  if (kind === 'credit-allowance') return t('kindCreditAllowance')
  return kind
}

/**
 * What one action is called.
 * @param action - what happened to the record.
 * @param t - the translator.
 * @returns the reader's label for it.
 */
export function actionLabel(action: AuditEntryView['action'], t: Translate): string {
  if (action === 'added') return t('actionAdded')
  if (action === 'changed') return t('actionChanged')
  return t('actionRemoved')
}

/**
 * Render one changed field.
 * @param props - the change and what to call things.
 * @returns the row element tree.
 */
function ChangeRow({ change, t }: { change: AuditChangeView; t: Translate }) {
  return (
    <li className={css.change}>
      <span className={css.changeField}>{change.field}</span>
      {change.before === undefined ? null : (
        <>
          <span className={css.changeLabel}>{t('fieldWas')}</span>
          <code className={css.changeValue}>{change.before === '' ? t('fieldEmpty') : change.before}</code>
        </>
      )}
      {change.after === undefined ? null : (
        <>
          <span className={css.changeLabel}>{t('fieldNow')}</span>
          <code className={css.changeValue}>{change.after === '' ? t('fieldEmpty') : change.after}</code>
        </>
      )}
      {change.truncated === true ? <Tag tone="neutral">{t('truncated')}</Tag> : null}
      {change.redacted === true ? <Tag tone="neutral">{t('redacted')}</Tag> : null}
    </li>
  )
}

/**
 * Render one recorded change.
 * @param props - the entry and what to call things.
 * @returns the entry element tree.
 */
function EntryRow({ entry, t }: { entry: AuditEntryView; t: Translate }) {
  return (
    <li className={css.entry}>
      <div className={css.entryMain}>
        <span className={css.entryName}>{entry.subjectName}</span>
        <Tag tone="neutral">{kindLabel(entry.kind, t)}</Tag>
        <span className={css.changeLabel}>{actionLabel(entry.action, t)}</span>
      </div>
      <div className={css.entryFacts}>
        <span className={css.entryTime}>{entry.at}</span>
        <span>{`${t('by')} ${entry.by}`}</span>
        {entry.organization === undefined ? null : (
          <span>{`${t('organization')}: ${entry.organization}`}</span>
        )}
      </div>
      {entry.changes.length === 0
        ? <p className={css.hint}>{t('noFields')}</p>
        : (
          <ul className={css.changes}>
            {entry.changes.map(change => <ChangeRow key={change.field} change={change} t={t} />)}
          </ul>
        )}
      {entry.changes.some(change => change.truncated === true)
        ? <p className={css.hint}>{t('truncatedHint')}</p>
        : null}
      {entry.changes.some(change => change.redacted === true)
        ? <p className={css.hint}>{t('redactedHint')}</p>
        : null}
      <p className={css.entryId}>
        <span>{t('subjectId')}</span>
        <code className={css.entryIdValue}>{entry.subject}</code>
      </p>
    </li>
  )
}

/**
 * The history section.
 * @param props - the locale seat, the store share and the injected face.
 * @returns the section element tree.
 */
export function HistorySection({ t, useStore, load, retry, loadMore }: HistorySectionProps) {
  const status = useStore(state => state.status)
  const entries = useStore(state => state.entries)
  const more = useStore(state => state.more)
  const loadingMore = useStore(state => state.loadingMore)
  const oldest = entries[entries.length - 1]?.id

  // The read starts when the section opens rather than at plugin load: a
  // reader who never opens this should not cost the deployment a request.
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
      {status === 'unavailable' ? <p className={css.notice}>{t('unavailable')}</p> : null}
      {status === 'forbidden' ? <p className={css.notice}>{t('forbidden')}</p> : null}
      {status === 'failed' ? (
        <div className={css.notice}>
          <p>{t('failed')}</p>
          <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      ) : null}
      {/* jscpd:ignore-end */}

      {status !== 'ready' ? null : (
        <>
          <div className={css.toolbar}>
            <Button variant="outline" onClick={() => { void retry() }}>{t('refresh')}</Button>
            <p className={css.hint}>{t('pageHint')}</p>
          </div>
          {entries.length === 0
            ? <p className={css.notice}>{t('none')}</p>
            : (
              <>
                <ul className={css.list}>
                  {entries.map(entry => <EntryRow key={entry.id} entry={entry} t={t} />)}
                </ul>
                {more && oldest !== undefined
                  ? (
                    <Button variant="outline" disabled={loadingMore} onClick={() => { void loadMore(oldest) }}>
                      {loadingMore ? t('loadingMore') : t('loadMore')}
                    </Button>
                  )
                  : <p className={css.hint}>{t('allShown')}</p>}
              </>
            )}
        </>
      )}
    </div>
  )
}
