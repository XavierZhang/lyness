/**
 * The administration console's shell: a navigation column, a header, and one
 * administration page at a time.
 *
 * It is registered into the built-in `root` slot, so on the console's own page
 * it renders instead of the workbench frame — the console is a page of its
 * own, not a panel inside the product. It declares two seats: the
 * administration pages, which are the console's content, and the shell overlay,
 * so the sign-in screen and the toasts a page raises still have somewhere to
 * appear.
 *
 * Everything it renders arrives through the framework shares: the pages from
 * the `admin.section` ledger, who is viewing from the viewer hook, and every
 * string from its own dictionary.
 */
import type { ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { createAdminConsoleStore } from './store.ts'
import css from './AdminFrame.module.css'

/** One administration page as the navigation column shows it. */
export interface AdminSectionRow {
  /** The page's id, which is also the selection key. */
  readonly id: string
  /** Its position within its group, as the page itself declared it. */
  readonly order: number
  /** Its own localized name. */
  readonly label: string
}

/** One standing the viewer holds, as the console offers it. */
export interface AdminStandingRow {
  /** Stable identity of the standing, which is what a switch names. */
  readonly id: string
  /** What it may do. */
  readonly role: 'platform-administrator' | 'tenant-administrator' | 'member'
  /** The organization it is in; absent for a platform administrator. */
  readonly organization?: string
}

/** Who the console says is viewing it. */
export interface AdminViewerRow {
  /** The display name, or undefined when nobody is signed in. */
  readonly name: string | undefined
  /** Where the browser goes to sign out, or undefined when this deployment has no accounts. */
  readonly signOutPath: string | undefined
  /**
   * Whether this viewer administers anything this deployment keeps.
   *
   * False is a member who reached the console's URL: every page here would
   * refuse their calls, so the console says so instead of listing pages that
   * answer nothing. A deployment with no accounts answers true — the person at
   * the keyboard is its operator.
   */
  readonly administers: boolean
  /** Whether this deployment has accounts at all; false is the single-operator shape. */
  readonly accounts: boolean
  /** Whether somebody is signed in. */
  readonly signedIn: boolean
  /** The channels the console may offer on its sign-in page. */
  readonly channels: readonly AdminChannelRow[]
  /**
   * Every standing this viewer holds, so the console can ask which one they
   * are acting for.
   *
   * One entry is the standing their sign-in already put in force. Several
   * with none in force is a person this deployment cannot act for yet: every
   * page here would refuse, so the console asks instead of listing them.
   */
  readonly standings: readonly AdminStandingRow[]
  /** The standing in force, when one is; it is one of {@link standings}. */
  readonly standing: string | undefined
}

/** One sign-in channel the console's own sign-in page offers. */
export interface AdminChannelRow {
  /** Where the browser goes to begin this channel's sign-in. */
  readonly href: string
  /** The channel's own name. */
  readonly displayName: string
}

/** The console's navigation groups, in the order the column shows them. */
export const GROUPS = [
  { key: 'organization', sections: ['people', 'invitations', 'bots', 'credits'] },
  { key: 'capability', sections: ['sign-in-channels', 'models', 'agent-presets', 'plugins'] },
  { key: 'platform', sections: ['history'] },
] as const satisfies readonly { key: string; sections: readonly string[] }[]

/** A group key, or the trailing group every unlisted page falls into. */
export type AdminGroupKey = typeof GROUPS[number]['key'] | 'other'

/** One rendered navigation group. */
interface RenderedGroup {
  readonly key: AdminGroupKey
  readonly rows: readonly AdminSectionRow[]
}

/** The console's injected business face. */
export interface AdminFrameInjected {
  hooks: {
    /** The administration pages currently offered, in declared order. */
    sections: HostObservable<readonly AdminSectionRow[]>
    /** Who is viewing, and how they sign out. */
    viewer: HostObservable<AdminViewerRow>
  }
  /**
   * Act in one of the viewer's own standings.
   * @param standing - the standing to put in force.
   */
  act: (standing: string) => void
}

/** Full composed props: runtime, the two child seats, the store, locale, and the injected face. */
export type AdminFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'admin.section'>
  & PropsStore<ReturnType<typeof createAdminConsoleStore>>
  & PropsLocale<'admin.console'>
  & InjectFace<AdminFrameInjected>

/** The translator the console's parts are handed. */
type Translate = PropsLocale<'admin.console'>['t']

/** No page at all, for a viewer who administers nothing. */
const EMPTY: readonly AdminSectionRow[] = []

/**
 * Place every offered page into its group, keeping each group's declared order.
 *
 * A page the console does not place by name still appears, in a trailing
 * group: a module this shell has never heard of is a page an administrator
 * must still be able to reach.
 * @param rows - the pages currently offered.
 * @returns one entry per non-empty group, groups in navigation order.
 */
export function groupSections(rows: readonly AdminSectionRow[]): readonly RenderedGroup[] {
  const placed = new Set<string>()
  const groups: RenderedGroup[] = []
  for (const group of GROUPS) {
    const members = rows.filter(row => group.sections.includes(row.id as never))
    for (const row of members) placed.add(row.id)
    if (members.length > 0) groups.push({ key: group.key, rows: [...members].sort((a, b) => a.order - b.order) })
  }
  const rest = rows.filter(row => !placed.has(row.id))
  if (rest.length > 0) groups.push({ key: 'other', rows: [...rest].sort((a, b) => a.order - b.order) })
  return groups
}

/**
 * The page the console shows: the selected one while it is still offered,
 * otherwise the first page there is.
 * @param rows - the pages currently offered.
 * @param selected - the id the store holds.
 * @returns the page to render, or undefined when none is offered.
 */
export function activeSection(
  rows: readonly AdminSectionRow[],
  selected: string | undefined,
): AdminSectionRow | undefined {
  return rows.find(row => row.id === selected) ?? rows[0]
}

/** What the content column says when there is no page to show. */
function Nothing({ administers, t }: { readonly administers: boolean; readonly t: Translate }): ReactNode {
  return (
    <div className={css.empty}>
      <h1 className={css.emptyTitle}>{administers ? t('empty') : t('refused')}</h1>
      <p className={css.emptyHint}>{administers ? t('emptyHint') : t('refusedHint')}</p>
    </div>
  )
}

/** The open administration page, under the console's header. */
function OpenPage({ active, renderSlot }: {
  readonly active: AdminSectionRow
  readonly renderSlot: AdminFrameProps['renderSlot']
}): ReactNode {
  return (
    <>
      <header className={css.header}>
        <h1 className={css.headerTitle}>{active.label}</h1>
      </header>
      {/* A section's `close` leaves the console where it is: there is no panel here to close. */}
      <div className={css.page}>
        {renderSlot('admin.section', { close: () => {} }, { only: active.id })}
      </div>
    </>
  )
}

/** The console's brand block and navigation column. */
function Navigation({ groups, activeId, onSelect, t }: {
  readonly groups: readonly RenderedGroup[]
  readonly activeId: string | undefined
  readonly onSelect: (id: string) => void
  readonly t: Translate
}): ReactNode {
  return (
    <nav className={css.nav} aria-label={t('console')}>
      {groups.map(group => (
        <div className={css.group} key={group.key}>
          <div className={css.groupHeading}>{t(`group_${group.key}`)}</div>
          {group.rows.map(row => (
            <button
              className={css.navRow}
              key={row.id}
              type="button"
              aria-current={row.id === activeId ? 'page' : undefined}
              onClick={() => { onSelect(row.id) }}
            >
              {row.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** The console's own sign-in page: the way in, and nothing behind it. */
function SignInPage({ channels, t }: {
  readonly channels: readonly AdminChannelRow[]
  readonly t: Translate
}): ReactNode {
  return (
    <div className={css.signIn}>
      <div className={css.signInCard}>
        <span className={css.signInBrand}>{t('console')}</span>
        <h1 className={css.signInTitle}>{t('signInTitle')}</h1>
        <p className={css.signInHint}>{t('signInHint')}</p>
        {channels.length === 0 ? <p className={css.signInEmpty}>{t('signInNoChannel')}</p> : null}
        <div className={css.signInChannels}>
          {channels.map(channel => (
            <a className={css.signInChannel} key={channel.href} href={channel.href}>{channel.displayName}</a>
          ))}
        </div>
        <a className={css.signInBack} href="./">{t('workbench')}</a>
      </div>
    </div>
  )
}

/**
 * What one standing is called.
 * @param standing - the standing as the deployment reports it.
 * @param t - the translator.
 * @returns the organization it is in, or the word for the whole platform, with its role.
 */
export function standingLabel(standing: AdminStandingRow, t: Translate): string {
  const role = standing.role === 'platform-administrator'
    ? t('rolePlatform')
    : standing.role === 'tenant-administrator' ? t('roleTenant') : t('roleMember')
  return t('standing', { where: standing.organization ?? t('platformWide'), role })
}

/**
 * The page a person with several standings and none in force gets.
 *
 * Every page behind it would refuse, because a call acting in no standing
 * authorizes nothing: which organization they are acting for is the one
 * question the deployment cannot answer for them.
 */
function ChoosePage({ standings, act, t }: {
  readonly standings: readonly AdminStandingRow[]
  readonly act: (standing: string) => void
  readonly t: Translate
}): ReactNode {
  return (
    <div className={css.signIn}>
      <div className={css.signInCard}>
        <span className={css.signInBrand}>{t('console')}</span>
        <h1 className={css.signInTitle}>{t('chooseTitle')}</h1>
        <p className={css.signInHint}>{t('chooseHint')}</p>
        <div className={css.signInChannels}>
          {standings.map(standing => (
            <button
              className={css.signInChannel}
              key={standing.id}
              type="button"
              onClick={() => { act(standing.id) }}
            >
              {standingLabel(standing, t)}
            </button>
          ))}
        </div>
        <a className={css.signInBack} href="./">{t('workbench')}</a>
      </div>
    </div>
  )
}

/**
 * Render the console.
 * @param props - composed slot props.
 * @returns the console's element tree.
 */
export function AdminFrame({ renderSlot, useStore, actions, useSections, useViewer, act, t }: AdminFrameProps): ReactNode {
  const viewer = useViewer(value => value)
  const offered = useSections(value => value)
  // A member is offered nothing rather than a nav of pages that refuse them.
  const rows = viewer.administers ? offered : EMPTY
  const selected = useStore(state => state.activeId)
  const active = activeSection(rows, selected)
  const groups = groupSections(rows)

  // A deployment with accounts and nobody in one shows the console's own
  // sign-in page and nothing else: the pages behind it would refuse every
  // call, and the workbench's covering overlay belongs to the workbench's
  // frame, which does not render here.
  if (viewer.accounts && !viewer.signedIn) return <SignInPage channels={viewer.channels} t={t} />

  // Signed in, holding more than one standing, and acting in none: the
  // console asks which one before it offers anything, because that choice is
  // this person's and every page here needs its answer.
  if (viewer.standing === undefined && viewer.standings.length > 1) {
    return <ChoosePage standings={viewer.standings} act={act} t={t} />
  }

  return (
    <div className={css.shell}>
      <aside className={css.sider}>
        <div className={css.brand}>
          <span className={css.brandName}>{t('console')}</span>
        </div>
        <Navigation groups={groups} activeId={active?.id} onSelect={actions.select} t={t} />
        <div className={css.siderFooter}>
          <span className={css.viewer}>
            {viewer.name === undefined ? t('nobody') : t('signedInAs', { name: viewer.name })}
          </span>
          {viewer.standings.filter(standing => standing.id !== viewer.standing).map(standing => (
            <button
              className={css.siderLink}
              key={standing.id}
              type="button"
              onClick={() => { act(standing.id) }}
            >
              {t('actAs', { standing: standingLabel(standing, t) })}
            </button>
          ))}
          {viewer.signOutPath === undefined
            ? null
            : <a className={css.siderLink} href={viewer.signOutPath}>{t('signOut')}</a>}
          <a className={css.siderLink} href="./">{t('workbench')}</a>
        </div>
      </aside>

      <main className={css.content}>
        {active === undefined
          ? <Nothing administers={viewer.administers} t={t} />
          : <OpenPage active={active} renderSlot={renderSlot} />}
      </main>
    </div>
  )
}
