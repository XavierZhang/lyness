/** The development manual is read-only help: it installs nothing and changes no bundle. */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { TranslateNS } from '@lyness/lyn-client-ui-slots'
import { Button, IconCloseOutlineRegular, MarkdownText, Modal, SegmentedTabs } from '@lyness/lyn-client-ui-primitives'
import type { SegmentedTab } from '@lyness/lyn-client-ui-primitives'
import type { PluginDevGuideKey } from './guide-locales.ts'
import css from './DevGuideDialog.module.css'

/** One chapter of the manual. */
export type DevGuidePage = 'overview' | 'host' | 'ui' | 'mcp' | 'install'

/** The locale keys one chapter renders. */
export interface DevGuideChapter {
  /** Tab label. */
  readonly tab: PluginDevGuideKey
  /** Chapter body, as Markdown. */
  readonly body: PluginDevGuideKey
}

/**
 * The chapters, in reading order: what a plugin is, then one chapter per face,
 * then what installation checks.
 */
export const DEV_GUIDE_CHAPTERS: readonly (readonly [DevGuidePage, DevGuideChapter])[] = [
  ['overview', { tab: 'devGuideOverviewTab', body: 'devGuideOverview' }],
  ['host', { tab: 'devGuideHostTab', body: 'devGuideHost' }],
  ['ui', { tab: 'devGuideUiTab', body: 'devGuideUi' }],
  ['mcp', { tab: 'devGuideMcpTab', body: 'devGuideMcp' }],
  ['install', { tab: 'devGuideInstallTab', body: 'devGuideInstall' }],
]

/** One tab per chapter; the list is fixed, so it is never empty. */
function chapterTabs(
  guideId: string,
  t: TranslateNS<'pluginManager'>,
): readonly [SegmentedTab<DevGuidePage>, ...SegmentedTab<DevGuidePage>[]] {
  const [first, ...rest] = DEV_GUIDE_CHAPTERS.map(([value, chapter]) => ({
    value,
    label: t(chapter.tab),
    id: `${guideId}-${value}-tab`,
    panelId: `${guideId}-${value}-panel`,
  }))
  return [first as SegmentedTab<DevGuidePage>, ...rest]
}

/**
 * Keep keyboard focus inside the manual while Tab moves through its controls.
 * @param event - keyboard event from the active reader.
 */
export function trapDevGuideTab(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Tab') return
  const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
  )).filter(element => !element.closest('[hidden]'))
  const first = targets[0]
  const last = targets[targets.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

/**
 * The plugin development manual.
 * @param props - the active translator and the dismissal callback.
 * @returns the manual dialog.
 */
export function DevGuideDialog({ t, onClose }: {
  t: TranslateNS<'pluginManager'>
  onClose: () => void
}): ReactNode {
  const [page, setPage] = useState<DevGuidePage>('overview')
  const guideId = useId()
  const content = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    content.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
  }, [])

  // The manual sits above the Plugins page. Escape dismisses only this layer
  // and returns focus to the control that opened it.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else trapDevGuideTab(event)
  }

  return (
    <Modal open headless onClose={onClose} title={t('devGuideTitle')} className={css.guideDialog as string}>
      <div ref={content} className={css.guideLayout} role="presentation" onKeyDownCapture={onKeyDown}>
        <div className={css.guideHeader}>
          <div className={css.guideTitleRow}>
            <h2 className={css.guideTitle}>{t('devGuideTitle')}</h2>
            <Button variant="ghost" className={css.guideClose} aria-label={t('close')} onClick={onClose}>
              <IconCloseOutlineRegular size={18} />
            </Button>
          </div>
          <p className={css.guideIntro}>{t('devGuideIntro')}</p>
        </div>
        <SegmentedTabs<DevGuidePage>
          className={css.guideTabs}
          label={t('devGuideSections')}
          value={page}
          onChange={setPage}
          items={chapterTabs(guideId, t)}
        />
        {DEV_GUIDE_CHAPTERS.map(([value, chapter]) => (
          <div
            key={value}
            id={`${guideId}-${value}-panel`}
            role="tabpanel"
            aria-labelledby={`${guideId}-${value}-tab`}
            className={css.guidePanel}
            data-guide-page={value}
            hidden={page !== value}
            tabIndex={0}
          >
            <MarkdownText
              text={t(chapter.body)}
              labels={{
                code: {
                  copyLabel: t('devGuideCopy'),
                  copiedLabel: t('devGuideCopied'),
                  toolbarLabels: {
                    codeLabel: t('codeBlock.title'),
                    wrapLabel: t('codeBlock.wrap'),
                    unwrapLabel: t('codeBlock.unwrap'),
                  },
                },
                footnotes: t('devGuideFootnotes'),
              }}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}
