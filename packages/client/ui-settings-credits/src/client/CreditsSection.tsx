/**
 * The credits section in Settings: what this account may spend, where it went,
 * and — for a standing that administers somebody — the two decisions an
 * administrator makes.
 *
 * The administrator forms are rendered from the account's own `administrable`
 * field, so the surface never offers a control the next call would refuse.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Input, SegmentedControl } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {
  AllowanceInput, AllowanceOverrideView, BudgetView, CreditAccountView, CreditGrantInput, ResetPeriodView,
} from '@lyness/lyn-api-credits-controller/types'
import type { createCreditsSectionStore } from './store.ts'
import css from './CreditsSection.module.css'

/** Injected business face: the read, the retry, and the two changes. */
export interface CreditsSectionInjected {
  /** Read the account, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Grant credits to one person. */
  grant: (input: CreditGrantInput) => Promise<void>
  /** Save one recurring-allowance override. */
  setAllowance: (input: AllowanceInput) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type CreditsSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createCreditsSectionStore>>
  & PropsLocale<'settings.credits'> & CreditsSectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.credits'>['t']

/**
 * Render the balance as three figures and the next allowance.
 * @param props - the account and the active translator.
 * @returns the balance element tree.
 */
function Balance({ account, t }: { account: CreditAccountView; t: Translate }) {
  return (
    <div className={css.balance}>
      <div className={css.figure}>
        <span className={css.figureValue}>{account.available}</span>
        <span className={css.figureLabel}>{t('available')}</span>
      </div>
      <div className={css.figure}>
        <span className={css.figureValue}>{account.granted}</span>
        <span className={css.figureLabel}>{t('granted')}</span>
      </div>
      <div className={css.figure}>
        <span className={css.figureValue}>{account.spent}</span>
        <span className={css.figureLabel}>{t('spent')}</span>
      </div>
      {account.nextGrantAt === undefined ? null : (
        <p className={css.next}>{t('nextGrant', { at: new Date(account.nextGrantAt).toLocaleString() })}</p>
      )}
    </div>
  )
}

/**
 * Render every grant and debit, newest first within each.
 * @param props - the account and the active translator.
 * @returns the ledger element tree.
 */
function Ledger({ account, t }: { account: CreditAccountView; t: Translate }) {
  if (account.grants.length === 0 && account.debits.length === 0) {
    return <p className={css.notice}>{t('ledgerEmpty')}</p>
  }
  const reason = (grant: CreditAccountView['grants'][number]): string => {
    if (grant.reason === 'periodic') return t('reasonPeriodic')
    if (grant.reason === 'purchase') return t('reasonPurchase')
    // A grant whose granter the ledger did not record still says how it
    // arrived, rather than naming nobody.
    const by = grant.grantedBy
    return by === undefined ? t('reasonGranted') : t('reasonAdministrator', { person: by })
  }
  return (
    <div className={css.ledger}>
      {account.grants.length === 0 ? null : (
        <section className={css.ledgerGroup}>
          <h4 className={css.ledgerHeading}>{t('grantsHeading')}</h4>
          <ul className={css.entries}>
            {account.grants.map(grant => (
              <li className={css.entry} key={grant.id}>
                <span className={css.entryAmount}>{`+${String(grant.amount)}`}</span>
                <span className={css.entryWhat}>{reason(grant)}</span>
                <span className={css.entryWhen}>
                  <time dateTime={grant.grantedAt}>{new Date(grant.grantedAt).toLocaleDateString()}</time>
                  {grant.expiresAt === undefined ? null : (
                    <span className={css.lapses}>{t('lapses', { at: new Date(grant.expiresAt).toLocaleDateString() })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {account.debits.length === 0 ? null : (
        <section className={css.ledgerGroup}>
          <h4 className={css.ledgerHeading}>{t('debitsHeading')}</h4>
          <ul className={css.entries}>
            {account.debits.map(debit => (
              <li className={css.entry} key={debit.id}>
                <span className={css.entryAmount}>{`-${String(debit.amount)}`}</span>
                <span className={css.entryWhat}>{t('spentOn', { session: debit.session })}</span>
                <span className={css.entryWhen}>
                  <time dateTime={debit.at}>{new Date(debit.at).toLocaleDateString()}</time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * Render what one organization bought, and what is left of it this period.
 *
 * Read-only here whatever the standing: only the platform changes the
 * ceiling, and this section belongs to the person reading their own credits.
 * @param props - the ceiling and what to call things.
 * @returns the block element tree.
 */
function Budget({ budget, t }: { budget: BudgetView; t: Translate }) {
  return (
    <div className={css.balance}>
      {budget.periodicAmount === undefined ? <p className={css.notice}>{t('budgetNone')}</p> : (
        <>
          <div className={css.figure}>
            <span className={css.figureValue}>{budget.periodicAmount}</span>
            <span className={css.figureLabel}>{t('budgetCeiling')}</span>
          </div>
          <div className={css.figure}>
            <span className={css.figureValue}>{budget.spent}</span>
            <span className={css.figureLabel}>{t('budgetSpent')}</span>
          </div>
          <div className={css.figure}>
            <span className={css.figureValue}>{budget.remaining}</span>
            <span className={css.figureLabel}>{t('budgetRemaining')}</span>
          </div>
          {budget.nextPeriodAt === undefined ? null : (
            <p className={css.next}>{t('budgetTurns', { at: new Date(budget.nextPeriodAt).toLocaleString() })}</p>
          )}
        </>
      )}
      <p className={css.next}>{t('budgetPlatformOnly')}</p>
    </div>
  )
}

/**
 * Render the grant form.
 * @param props - the submit callback, whether a change is in flight, and the translator.
 * @returns the grant form element tree.
 */
function GrantForm({ grant, working, t }: {
  grant: (input: CreditGrantInput) => Promise<void>
  working: boolean
  t: Translate
}) {
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const submit = useCallback((): void => {
    // The amount is read as a whole number here so the form refuses what the
    // server would refuse; everything else is the server's own rule.
    const value = Number.parseInt(amount, 10)
    if (person.trim().length === 0 || !Number.isInteger(value) || value <= 0) return
    void grant({
      person: person.trim(),
      amount: value,
      // A date input gives a calendar day; the wire takes a UTC instant.
      ...expiresAt === '' ? {} : { expiresAt: new Date(`${expiresAt}T00:00:00Z`).toISOString() },
    })
  }, [amount, expiresAt, grant, person])

  return (
    <form
      className={css.form}
      onSubmit={(event) => { event.preventDefault(); submit() }}
    >
      <h4 className={css.formHeading}>{t('grantHeading')}</h4>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('grantPerson')}</span>
        <Input value={person} onChange={(event) => { setPerson(event.target.value) }} />
        <span className={css.fieldHint}>{t('grantPersonHint')}</span>
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('grantAmount')}</span>
        <Input type="number" min={1} step={1} value={amount} onChange={(event) => { setAmount(event.target.value) }} />
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('grantExpires')}</span>
        <Input type="date" value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value) }} />
        <span className={css.fieldHint}>{t('grantExpiresHint')}</span>
      </label>
      <Button type="submit" variant="primary" disabled={working}>{t('grantSubmit')}</Button>
    </form>
  )
}

/**
 * Render the recurring-allowance form.
 * @param props - the submit callback, what the allowance currently reads as, and the translator.
 * @returns the allowance form element tree.
 */
function AllowanceForm({ setAllowance, working, current, t }: {
  setAllowance: (input: AllowanceInput) => Promise<void>
  working: boolean
  current: AllowanceOverrideView | undefined
  t: Translate
}) {
  const [scope, setScope] = useState<'person' | 'organization'>('person')
  const [subject, setSubject] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<ResetPeriodView>('monthly')
  const submit = useCallback((): void => {
    if (subject.trim().length === 0) return
    const value = Number.parseInt(amount, 10)
    void setAllowance({
      ...scope === 'person' ? { person: subject.trim() } : { organization: subject.trim() },
      ...Number.isInteger(value) && value >= 0 ? { periodicAmount: value } : {},
      period,
    })
  }, [amount, period, scope, setAllowance, subject])

  return (
    <form
      className={css.form}
      onSubmit={(event) => { event.preventDefault(); submit() }}
    >
      <h4 className={css.formHeading}>{t('allowanceHeading')}</h4>
      <SegmentedControl
        id="credits-allowance-scope"
        value={scope}
        label={t('allowanceScope')}
        options={[
          { value: 'person', label: t('allowanceScopePerson') },
          { value: 'organization', label: t('allowanceScopeOrganization') },
        ]}
        onChange={setScope}
      />
      <label className={css.field}>
        <span className={css.fieldLabel}>{scope === 'person' ? t('grantPerson') : t('allowanceOrganization')}</span>
        <Input value={subject} onChange={(event) => { setSubject(event.target.value) }} />
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('allowanceAmount')}</span>
        <Input type="number" min={0} step={1} value={amount} onChange={(event) => { setAmount(event.target.value) }} />
        <span className={css.fieldHint}>
          {current?.periodicAmount === undefined
            ? t('allowanceInherited')
            : t('allowanceSetBy', { person: current.setBy })}
        </span>
      </label>
      <SegmentedControl
        id="credits-allowance-period"
        value={period}
        label={t('allowancePeriod')}
        options={[
          { value: 'daily', label: t('periodDaily') },
          { value: 'weekly', label: t('periodWeekly') },
          { value: 'monthly', label: t('periodMonthly') },
        ]}
        onChange={setPeriod}
      />
      <Button type="submit" variant="primary" disabled={working}>{t('allowanceSubmit')}</Button>
    </form>
  )
}

/**
 * Render the credits section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function CreditsSection({ t, useStore, load, retry, grant, setAllowance }: CreditsSectionProps) {
  const status = useStore(state => state.status)
  const account = useStore(state => state.account)
  const allowance = useStore(state => state.allowance)
  const budget = useStore(state => state.budget)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  return (
    <div className={css.section}>
      <header className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        <p className={css.intro}>{t('intro')}</p>
      </header>

      {status === 'loading' ? <p className={css.notice}>{t('loading')}</p> : null}
      {status === 'unavailable' ? <p className={css.notice}>{t('unavailable')}</p> : null}
      {status === 'failed' ? (
        <div className={css.notice}>
          <p>{t('failed')}</p>
          <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      ) : null}

      {account === undefined ? null : (
        <>
          <Balance account={account} t={t} />
          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('ledger')}</h3>
            <Ledger account={account} t={t} />
          </section>
          {budget === undefined ? null : (
            <section className={css.block}>
              <h3 className={css.blockHeading}>{t('budget')}</h3>
              <Budget budget={budget} t={t} />
            </section>
          )}
          {!account.administrable ? null : (
            <section className={css.block}>
              <h3 className={css.blockHeading}>{t('administration')}</h3>
              {working ? <p className={css.notice}>{t('working')}</p> : null}
              {outcome?.kind === 'granted' ? (
                <p className={css.done}>{t('grantDone', { person: outcome.person, amount: String(outcome.amount) })}</p>
              ) : null}
              {outcome?.kind === 'allowance' ? <p className={css.done}>{t('allowanceDone')}</p> : null}
              {outcome?.kind === 'refused' ? <p className={css.refused}>{t('refused', { reason: outcome.reason })}</p> : null}
              <div className={css.forms}>
                <GrantForm grant={grant} working={working} t={t} />
                <AllowanceForm setAllowance={setAllowance} working={working} current={allowance?.own} t={t} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
