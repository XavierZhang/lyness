/**
 * The page somebody with an invitation code opens: what the code admits them
 * to, and the directories they can sign in through to redeem it.
 *
 * It is registered into the built-in `root` slot, so on its own page it
 * renders instead of the workbench frame: whoever opens it has no account
 * here yet, and the workbench would be a product they cannot use.
 *
 * It never reads the invitation. A page that said whether a code is valid
 * would answer that question to anybody who asked; the sign-in that redeems
 * it is where the answer belongs.
 *
 * Somebody already signed in sees one button instead of the directories. A
 * code they were forwarded changes nothing on its own — it is only when they
 * press it that the deployment is asked, which is what makes the standing
 * theirs to accept rather than something a link did to their account.
 */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { Role } from '@deepseek-ai/dsh-api-invitations-controller/types'
import type { AcceptanceRow } from './acceptance.ts'
import css from './JoinPage.module.css'

/** One directory this page offers, with the code already on the link. */
export interface JoinChannelRow {
  /** Where the browser goes to begin this channel's sign-in, carrying the code. */
  readonly href: string
  /** The channel's own name. */
  readonly displayName: string
}

/** What this page knows about the visit. */
export interface JoinVisitRow {
  /** Whether the link carried a code at all. */
  readonly invited: boolean
  /** Whether this deployment has accounts; false is the single-operator shape. */
  readonly accounts: boolean
  /** Whether somebody is already signed in, for whom a code changes nothing. */
  readonly signedIn: boolean
  /** The directories this page offers, each carrying the code. */
  readonly channels: readonly JoinChannelRow[]
}

/** The page's injected business face. */
export interface JoinPageInjected {
  hooks: {
    /** What this page knows about the visit. */
    visit: { getSnapshot: () => JoinVisitRow; subscribe: (listener: () => void) => () => void }
    /** Where this visit's acceptance has got to. */
    acceptance: { getSnapshot: () => AcceptanceRow; subscribe: (listener: () => void) => () => void }
  }
  /** Accept the code this visit carries, as the person already signed in. */
  accept: () => Promise<void>
}

/** Full composed props: runtime, locale, and the injected face. */
export type JoinPageProps =
  & PropsRuntime<'root'>
  & PropsLocale<'join'>
  & InjectFace<JoinPageInjected>

/** The translator this page's parts are handed. */
type Translate = PropsLocale<'join'>['t']

/**
 * What the page says when there is nothing to redeem.
 * @param props - which case it is, and the translator.
 * @returns the message element tree.
 */
function Nothing({ title, hint, t }: { readonly title: string; readonly hint: string; readonly t: Translate }): ReactNode {
  return (
    <div className={css.card}>
      <span className={css.brand}>{t('kicker')}</span>
      <h1 className={css.title}>{title}</h1>
      <p className={css.hint}>{hint}</p>
      <a className={css.back} href="./">{t('workbench')}</a>
    </div>
  )
}

/**
 * The directories this page offers, each link already carrying the code.
 * @param props - the channels and the translator.
 * @returns the offer element tree.
 */
function Offer({ channels, t }: { readonly channels: readonly JoinChannelRow[]; readonly t: Translate }): ReactNode {
  return (
    <div className={css.card}>
      <span className={css.brand}>{t('kicker')}</span>
      <h1 className={css.title}>{t('title')}</h1>
      <p className={css.hint}>{t('hint')}</p>
      {channels.length === 0 ? <p className={css.empty}>{t('noChannel')}</p> : null}
      <div className={css.channels}>
        {channels.map(channel => (
          <a className={css.channel} key={channel.href} href={channel.href}>
            {t('continueWith', { name: channel.displayName })}
          </a>
        ))}
      </div>
      <p className={css.note}>{t('note')}</p>
    </div>
  )
}

/**
 * Why this visit has nothing to redeem, if it has nothing.
 *
 * Two cases, each a different thing to say: a link with no code at all, and a
 * deployment that admits its one operator and needs no invitation. Somebody
 * already signed in is not one of them — they are offered the acceptance
 * instead, which is the only way a code reaches an account that already
 * exists.
 * @param visit - what the page knows about the visit.
 * @returns the case's copy prefix, or undefined when there is a code to act on.
 */
export function blockedBy(visit: JoinVisitRow): 'noCode' | 'noAccounts' | undefined {
  if (!visit.invited) return 'noCode'
  if (!visit.accounts) return 'noAccounts'
  return undefined
}

/**
 * What to call one standing in the sentence that reports it.
 * @param role - what the standing may do.
 * @param organization - the organization it is in, where it names one.
 * @param t - the translator.
 * @returns the standing, named the way the roster surfaces name it.
 */
export function standingLabel(role: Role, organization: string | undefined, t: Translate): string {
  const named = role === 'platform-administrator'
    ? t('rolePlatform')
    : role === 'tenant-administrator' ? t('roleTenant') : t('roleMember')
  return `${organization ?? t('deploymentWide')} · ${named}`
}

/**
 * The standing one accepted row reports.
 * @param row - the accepted row.
 * @param t - the translator.
 * @returns the sentence naming what they now hold.
 */
function acceptedHint(row: Extract<AcceptanceRow, { status: 'accepted' }>, t: Translate): string {
  return t('acceptedHint', { standing: standingLabel(row.role, row.organization, t) })
}

/**
 * The card somebody already signed in is offered.
 *
 * It names no standing before the acceptance, because the page has not read
 * the invitation and must not: what the code carries is told to the person
 * who accepted it, and to nobody who merely opened the link.
 * @param props - where the acceptance has got to, what to do, and the translator.
 * @returns the card element tree.
 */
function Accept({ row, accept, t }: {
  readonly row: AcceptanceRow
  readonly accept: () => Promise<void>
  readonly t: Translate
}): ReactNode {
  if (row.status === 'accepted') {
    return <Nothing title={t('acceptedTitle')} hint={acceptedHint(row, t)} t={t} />
  }
  if (row.status === 'nothing') return <Nothing title={t('nothingTitle')} hint={t('nothingHint')} t={t} />
  const working = row.status === 'working'
  return (
    <div className={css.card}>
      <span className={css.brand}>{t('kicker')}</span>
      <h1 className={css.title}>{t('acceptTitle')}</h1>
      <p className={css.hint}>{row.status === 'failed' ? t('failedHint') : t('acceptHint')}</p>
      <div className={css.channels}>
        <button className={css.channel} type="button" disabled={working} onClick={() => { void accept() }}>
          {working ? t('acceptWorking') : t(row.status === 'failed' ? 'retry' : 'acceptSubmit')}
        </button>
      </div>
      <p className={css.note}>{t('acceptNote')}</p>
      <a className={css.back} href="./">{t('workbench')}</a>
    </div>
  )
}

/**
 * Render the invitation page.
 * @param props - composed slot props.
 * @returns the page's element tree.
 */
export function JoinPage({ useVisit, useAcceptance, accept, t }: JoinPageProps): ReactNode {
  const visit = useVisit(value => value)
  const acceptance = useAcceptance(value => value)
  const blocked = blockedBy(visit)

  return (
    <div className={css.page}>
      {blocked !== undefined
        ? <Nothing title={t(`${blocked}Title`)} hint={t(`${blocked}Hint`)} t={t} />
        : visit.signedIn
          ? <Accept row={acceptance} accept={accept} t={t} />
          : <Offer channels={visit.channels} t={t} />}
    </div>
  )
}
