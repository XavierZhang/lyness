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
 */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@lyness/lyn-client-ui-slots'
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
  }
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
 * Three cases, each a different thing to say: a link with no code at all, a
 * deployment that admits its one operator and needs no invitation, and
 * somebody already signed in, for whom a code changes nothing.
 * @param visit - what the page knows about the visit.
 * @returns the case's copy prefix, or undefined when the code can be redeemed.
 */
export function blockedBy(visit: JoinVisitRow): 'noCode' | 'noAccounts' | 'signedIn' | undefined {
  if (!visit.invited) return 'noCode'
  if (!visit.accounts) return 'noAccounts'
  if (visit.signedIn) return 'signedIn'
  return undefined
}

/**
 * Render the invitation page.
 * @param props - composed slot props.
 * @returns the page's element tree.
 */
export function JoinPage({ useVisit, t }: JoinPageProps): ReactNode {
  const visit = useVisit(value => value)
  const blocked = blockedBy(visit)

  return (
    <div className={css.page}>
      {blocked === undefined
        ? <Offer channels={visit.channels} t={t} />
        : <Nothing title={t(`${blocked}Title`)} hint={t(`${blocked}Hint`)} t={t} />}
    </div>
  )
}
