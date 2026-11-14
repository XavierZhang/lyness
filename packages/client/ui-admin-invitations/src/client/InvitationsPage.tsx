/**
 * The invitations page in the administration console: the codes this
 * deployment has issued, the form that issues one, and the withdrawal that
 * stops one working.
 *
 * The code of a new invitation is shown once, here, because the answer that
 * carried it is the only place it ever exists: the deployment keeps its hash,
 * and an administrator who loses it issues another one.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Input, RiskConfirmation, SegmentedControl, Tag, useClipboardCopy } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InvitationInput, InvitationRowView, Role } from '@deepseek-ai/dsh-api-invitations-controller/types'
import type { createInvitationsPageStore } from './store.ts'
import css from './InvitationsPage.module.css'

/** How long an invitation stays redeemable, as the form offers it. */
const LIVES = [
  { days: 1, key: 'lifeDay' },
  { days: 7, key: 'lifeWeek' },
  { days: 30, key: 'lifeMonth' },
] as const

/** One day, in milliseconds, so the form sends what the seam bounds. */
const DAY_MS = 86_400_000

/** Injected business face: the read, the retry, the two changes, and where a code is redeemed. */
export interface InvitationsPageInjected {
  /** Read the invitations, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Issue one invitation. */
  issue: (input: InvitationInput) => Promise<void>
  /** Withdraw one invitation. */
  revoke: (id: string) => Promise<void>
  /** The path a redemption link carries the code to, as this deployment serves it. */
  joinPath: string
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type InvitationsPageProps =
  PropsRuntime<'admin.section'> & PropsStore<ReturnType<typeof createInvitationsPageStore>>
  & PropsLocale<'admin.invitations'> & InvitationsPageInjected

/** The translator this page's parts are handed. */
type Translate = PropsLocale<'admin.invitations'>['t']

/**
 * What one standing is called.
 * @param role - the standing as the wire names it.
 * @param t - the translator.
 * @returns the reader's word for it.
 */
function roleLabel(role: Role, t: Translate): string {
  if (role === 'platform-administrator') return t('rolePlatform')
  if (role === 'tenant-administrator') return t('roleTenant')
  return t('roleMember')
}

/**
 * Render one value the administrator has to carry elsewhere, with its copy action.
 * @param props - what to call it, the value itself, and what to call the copy.
 * @returns the copyable value element tree.
 */
function Copyable({ label, value, t }: { label: string; value: string; t: Translate }) {
  const { copied, onCopy } = useClipboardCopy(value)
  return (
    <div className={css.copyable}>
      <span className={css.copyableLabel}>{label}</span>
      <code className={css.copyableValue}>{value}</code>
      <Button variant="outline" onClick={onCopy}>{copied ? t('copied') : t('copy')}</Button>
    </div>
  )
}

/**
 * Render the code a new invitation carries, which is shown this once.
 * @param props - the invitation's label and code, where it is redeemed, and the translator.
 * @returns the issued-code element tree.
 */
function IssuedCode({ label, code, joinPath, t }: {
  label: string
  code: string
  joinPath: string
  t: Translate
}) {
  // Built from the page's own origin, because the link is for this
  // deployment: an administrator sends the address they are looking at. The
  // code travels as a query parameter, which is the path the Host serves and
  // the page reads it from.
  const link = `${window.location.origin}${joinPath}?invite=${encodeURIComponent(code)}`
  return (
    <section className={css.issued}>
      <h3 className={css.issuedHeading}>{t('issuedHeading', { label })}</h3>
      <p className={css.issuedHint}>{t('issuedHint')}</p>
      <Copyable label={t('issuedCode')} value={code} t={t} />
      <Copyable label={t('issuedLink')} value={link} t={t} />
    </section>
  )
}

/**
 * Render the form that issues one invitation.
 * @param props - whether a change is in flight, the fields to mark, and what to do on submit.
 * @returns the form element tree.
 */
function IssueForm({ working, marked, issue, t }: {
  working: boolean
  marked: readonly string[]
  issue: (input: InvitationInput) => Promise<void>
  t: Translate
}) {
  const [label, setLabel] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [organization, setOrganization] = useState('')
  const [uses, setUses] = useState('1')
  const [days, setDays] = useState('7')

  const submit = useCallback((): void => {
    if (label.trim().length === 0) return
    const counted = Number.parseInt(uses, 10)
    void issue({
      label: label.trim(),
      role,
      // A platform administrator's standing belongs to the platform rather
      // than to any organization, so the field is not sent for one.
      ...role === 'platform-administrator' || organization.trim().length === 0
        ? {}
        : { organization: organization.trim() },
      ...Number.isSafeInteger(counted) && counted > 0 ? { maxUses: counted } : {},
      lifetimeMs: Number(days) * DAY_MS,
    })
  }, [days, issue, label, organization, role, uses])

  return (
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h3 className={css.formHeading}>{t('issueHeading')}</h3>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('label')}</span>
        <Input value={label} onChange={(event) => { setLabel(event.target.value) }} />
        <span className={css.fieldHint}>{t('labelHint')}</span>
      </label>
      <SegmentedControl
        id="admin-invitations-role"
        value={role}
        label={t('role')}
        options={[
          { value: 'member', label: t('roleMember') },
          { value: 'tenant-administrator', label: t('roleTenant') },
          { value: 'platform-administrator', label: t('rolePlatform') },
        ]}
        onChange={setRole}
      />
      {role === 'platform-administrator' ? null : (
        <label className={marked.includes('organization') ? css.fieldMarked : css.field}>
          <span className={css.fieldLabel}>{t('organization')}</span>
          <Input value={organization} onChange={(event) => { setOrganization(event.target.value) }} />
          <span className={css.fieldHint}>{t('organizationHint')}</span>
        </label>
      )}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('uses')}</span>
        <Input value={uses} onChange={(event) => { setUses(event.target.value) }} />
        <span className={css.fieldHint}>{t('usesHint')}</span>
      </label>
      <SegmentedControl
        id="admin-invitations-life"
        value={days}
        label={t('life')}
        options={LIVES.map(one => ({ value: String(one.days), label: t(one.key) }))}
        onChange={setDays}
      />
      <Button type="submit" variant="primary" disabled={working}>{t('issueSubmit')}</Button>
    </form>
  )
}

/**
 * Render one issued invitation.
 * @param props - the invitation, what to call things, and how to withdraw it.
 * @returns the row element tree.
 */
function InvitationRow({ invitation, t, onRevoke }: {
  invitation: InvitationRowView
  t: Translate
  onRevoke: () => void
}) {
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowName}>{invitation.label}</span>
        <Tag tone={invitation.role === 'member' ? 'neutral' : 'success'}>{roleLabel(invitation.role, t)}</Tag>
        <Tag tone={invitation.open ? 'success' : 'neutral'}>{invitation.open ? t('open') : t('closed')}</Tag>
      </div>
      <div className={css.rowFacts}>
        <span className={css.rowScope}>
          {invitation.organization === undefined ? t('platformWide') : invitation.organization}
        </span>
        <span>{t('usesOf', { used: String(invitation.uses), total: String(invitation.maxUses) })}</span>
        <span className={css.rowWhen}>
          {t('expiresAt', { when: new Date(invitation.expiresAt).toLocaleDateString() })}
        </span>
      </div>
      {!invitation.open ? null : (
        <div className={css.rowActions}>
          <Button variant="outline" onClick={onRevoke}>{t('revoke')}</Button>
        </div>
      )}
    </li>
  )
}

/**
 * Render the invitations page.
 * @param props - composed slot props.
 * @returns the page element tree.
 */
export function InvitationsPage({ t, useStore, load, retry, issue, revoke, joinPath }: InvitationsPageProps) {
  const status = useStore(state => state.status)
  const invitations = useStore(state => state.invitations)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)
  const [revoking, setRevoking] = useState<InvitationRowView | undefined>(undefined)
  const [acknowledged, setAcknowledged] = useState(false)

  // The read starts when the page opens rather than at plugin load: an
  // administrator who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  const marked = outcome?.kind === 'refused' ? outcome.fields : []

  const confirmRevocation = useCallback((target: InvitationRowView): void => {
    setRevoking(undefined)
    setAcknowledged(false)
    void revoke(target.id)
  }, [revoke])

  return (
    <div className={css.section}>
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

      {status !== 'ready' ? null : (
        <>
          <section className={css.block}>
            {working ? <p className={css.notice}>{t('working')}</p> : null}
            {outcome?.kind === 'revoked' ? <p className={css.done}>{t('revokedDone')}</p> : null}
            {outcome?.kind === 'refused' ? <p className={css.refused}>{t('refused', { reason: outcome.reason })}</p> : null}
            {outcome?.kind !== 'issued' ? null : (
              <IssuedCode label={outcome.label} code={outcome.code} joinPath={joinPath} t={t} />
            )}
            <IssueForm working={working} marked={marked} issue={issue} t={t} />
          </section>

          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('roster')}</h3>
            {invitations.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
              <ul className={css.rows}>
                {invitations.map(invitation => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    t={t}
                    onRevoke={() => { setRevoking(invitation); setAcknowledged(false) }}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {revoking === undefined ? null : (
        <RiskConfirmation
          open
          title={t('revokeTitle', { label: revoking.label })}
          description={t('revokeBody')}
          acknowledgeLabel={t('revokeAcknowledge')}
          cancelLabel={t('revokeCancel')}
          closeLabel={t('close')}
          confirmLabel={t('revokeConfirm')}
          acknowledged={acknowledged}
          disabled={working}
          onAcknowledgedChange={setAcknowledged}
          onCancel={() => { setRevoking(undefined); setAcknowledged(false) }}
          onConfirm={() => { confirmRevocation(revoking) }}
        />
      )}
    </div>
  )
}
