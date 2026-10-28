/**
 * The people section in Settings: who may use this deployment, what each of
 * them may do, and which directory identity signs in as them.
 *
 * A person composition wrote is shown and not offered for editing: the
 * installation's files name them, so the next boot would undo a change made
 * here.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Input, RiskConfirmation, SegmentedControl, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  BindingInput, IdentityInput, PersonInput, PersonRowView, Role,
} from '@deepseek-ai/dsh-api-people-controller/types'
import type { ConfiguredChannelView } from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import type { createPeopleSectionStore } from './store.ts'
import css from './PeopleSection.module.css'

/** Injected business face: the read, the retry, and the four changes. */
export interface PeopleSectionInjected {
  /** Read the people and the channels, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Add one person, or change one. */
  save: (input: PersonInput) => Promise<void>
  /** Remove one person. */
  remove: (id: string) => Promise<void>
  /** Admit one directory identity as one person. */
  bind: (input: BindingInput) => Promise<void>
  /** Stop admitting one directory identity. */
  unbind: (input: IdentityInput) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type PeopleSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createPeopleSectionStore>>
  & PropsLocale<'settings.people'> & PeopleSectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.people'>['t']

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
 * Render the identities admitted as one person.
 * @param props - the person, what to call things, and how to withdraw one.
 * @returns the identity list element tree.
 */
function AdmittedIdentities({ person, t, onWithdraw }: {
  person: PersonRowView
  t: Translate
  onWithdraw: (identity: IdentityInput) => void
}) {
  if (person.bindings.length === 0) return <p className={css.rowHint}>{t('admittedNone')}</p>
  return (
    <ul className={css.identities}>
      {person.bindings.map(binding => (
        <li className={css.identity} key={`${binding.channel}/${binding.issuer}/${binding.subject}`}>
          <span className={css.identityValue}>{`${binding.issuer} / ${binding.subject}`}</span>
          {binding.written
            ? <Tag tone="neutral">{t('fromConfiguration')}</Tag>
            : (
              <Button
                variant="outline"
                onClick={() => {
                  onWithdraw({ channel: binding.channel, issuer: binding.issuer, subject: binding.subject })
                }}
              >
                {t('withdraw')}
              </Button>
            )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Render one person.
 * @param props - the person, what to call them, and the things to do with them.
 * @returns the row element tree.
 */
function PersonRow({ person, editing, t, onEdit, onRemove, onWithdraw }: {
  person: PersonRowView
  editing: boolean
  t: Translate
  onEdit: () => void
  onRemove: () => void
  onWithdraw: (identity: IdentityInput) => void
}) {
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowName}>{person.displayName}</span>
        <Tag tone={person.role === 'member' ? 'neutral' : 'success'}>{roleLabel(person.role, t)}</Tag>
        {person.written ? <Tag tone="neutral">{t('fromConfiguration')}</Tag> : null}
      </div>
      <div className={css.rowFacts}>
        <span className={css.rowScope}>
          {person.organization === undefined ? t('deploymentWide') : person.organization}
        </span>
      </div>
      {person.written ? <p className={css.rowHint}>{t('fromConfigurationHint')}</p> : null}
      <p className={css.rowId}>
        <span>{t('personId')}</span>
        <code className={css.rowIdValue}>{person.id}</code>
        <span className={css.rowHint}>{t('personIdHint')}</span>
      </p>
      <div className={css.rowFacts}>
        <span className={css.rowKind}>{t('admitted')}</span>
      </div>
      <AdmittedIdentities person={person} t={t} onWithdraw={onWithdraw} />
      {person.written ? null : (
        <div className={css.rowActions}>
          <Button variant="outline" onClick={onEdit}>{editing ? t('cancelEdit') : t('edit')}</Button>
          <Button variant="outline" onClick={onRemove}>{t('remove')}</Button>
        </div>
      )}
    </li>
  )
}

/**
 * Render the add-or-edit person form.
 * @param props - who is being edited, whether a change is in flight, and what to do on submit.
 * @returns the form element tree.
 */
function PersonForm({ editing, working, marked, save, t }: {
  editing: PersonRowView | undefined
  working: boolean
  marked: readonly string[]
  save: (input: PersonInput) => Promise<void>
  t: Translate
}) {
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '')
  const [role, setRole] = useState<Role>(editing?.role ?? 'member')
  const [organization, setOrganization] = useState(editing?.organization ?? '')

  // The form follows what it is editing: picking another row, or leaving edit
  // mode, must not leave the previous person's values in the fields.
  useEffect(() => {
    setDisplayName(editing?.displayName ?? '')
    setRole(editing?.role ?? 'member')
    setOrganization(editing?.organization ?? '')
  }, [editing])

  const submit = useCallback((): void => {
    if (displayName.trim().length === 0) return
    void save({
      ...editing === undefined ? {} : { id: editing.id },
      displayName: displayName.trim(),
      role,
      // A platform administrator's standing belongs to the platform rather
      // than to any organization, so the field is not sent for one.
      ...role === 'platform-administrator' || organization.trim().length === 0
        ? {}
        : { organization: organization.trim() },
    })
  }, [displayName, editing, organization, role, save])

  return (
    /* jscpd:ignore-start */
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h4 className={css.formHeading}>
        {editing === undefined ? t('addHeading') : t('editHeading', { name: editing.displayName })}
      </h4>
      {/* The markup of a Settings form field, and of the confirmation a
          destructive change goes through. Deliberately parallel to the
          sign-in channels section: what repeats is the shape, while the copy,
          the fields and the risk each names are this section's own. */}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('displayName')}</span>
        <Input value={displayName} onChange={(event) => { setDisplayName(event.target.value) }} />
        <span className={css.fieldHint}>{t('displayNameHint')}</span>
      </label>
      <SegmentedControl
        id="settings-people-role"
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
      <Button type="submit" variant="primary" disabled={working}>
        {editing === undefined ? t('submitNew') : t('submitEdit')}
      </Button>
      {/* jscpd:ignore-end */}
    </form>
  )
}

/**
 * Render the form that admits one directory identity as one person.
 * @param props - who it is for, the channels to pick from, and what to do on submit.
 * @returns the form element tree.
 */
function AdmitForm({ person, channels, working, bind, t }: {
  person: PersonRowView
  channels: readonly ConfiguredChannelView[]
  working: boolean
  bind: (input: BindingInput) => Promise<void>
  t: Translate
}) {
  const first = channels[0]?.id ?? ''
  const [channel, setChannel] = useState(first)
  const [issuer, setIssuer] = useState('')
  const [subject, setSubject] = useState('')

  // Following the person being admitted keeps one half-typed identity from
  // being submitted for somebody else.
  useEffect(() => {
    setChannel(first)
    setIssuer('')
    setSubject('')
  }, [first, person.id])

  const submit = useCallback((): void => {
    if (channel === '' || issuer.trim().length === 0 || subject.trim().length === 0) return
    void bind({ channel, issuer: issuer.trim(), subject: subject.trim(), person: person.id })
  }, [bind, channel, issuer, person.id, subject])

  if (channels.length === 0) return <p className={css.notice}>{t('admitChannelEmpty')}</p>

  return (
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h4 className={css.formHeading}>{t('admitHeading')}</h4>
      <SegmentedControl
        id="settings-people-channel"
        value={channel}
        label={t('admitChannel')}
        options={channels.map(one => ({ value: one.id, label: one.displayName }))}
        onChange={setChannel}
      />
      {/* jscpd:ignore-start */}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('admitIssuer')}</span>
        <Input value={issuer} onChange={(event) => { setIssuer(event.target.value) }} />
        <span className={css.fieldHint}>{t('admitIssuerHint')}</span>
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('admitSubject')}</span>
        <Input value={subject} onChange={(event) => { setSubject(event.target.value) }} />
        <span className={css.fieldHint}>{t('admitSubjectHint')}</span>
      </label>
      <Button type="submit" variant="primary" disabled={working}>{t('admitSubmit')}</Button>
      {/* jscpd:ignore-end */}
    </form>
  )
}

/**
 * Render the people section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function PeopleSection({ t, useStore, load, retry, save, remove, bind, unbind }: PeopleSectionProps) {
  const status = useStore(state => state.status)
  const people = useStore(state => state.people)
  const channels = useStore(state => state.channels)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [removing, setRemoving] = useState<PersonRowView | undefined>(undefined)
  const [acknowledged, setAcknowledged] = useState(false)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  const editing = people.find(one => one.id === editingId)
  const marked = outcome?.kind === 'refused' ? outcome.fields : []
  const withdraw = useCallback((identity: IdentityInput): void => { void unbind(identity) }, [unbind])

  /* jscpd:ignore-start */
  const confirmRemoval = useCallback((target: PersonRowView): void => {
    setRemoving(undefined)
    setAcknowledged(false)
    // The row being edited is the row being removed often enough to matter:
    // leaving edit mode on it would otherwise show a form for somebody who
    // no longer exists.
    if (target.id === editingId) setEditingId(undefined)
    void remove(target.id)
  }, [editingId, remove])
  /* jscpd:ignore-end */

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
          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('roster')}</h3>
            {/* jscpd:ignore-start */}
            {people.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
              <ul className={css.rows}>
                {people.map(person => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    editing={person.id === editingId}
                    t={t}
                    onEdit={() => { setEditingId(person.id === editingId ? undefined : person.id) }}
                    onRemove={() => { setRemoving(person); setAcknowledged(false) }}
                    onWithdraw={withdraw}
                  />
                ))}
              </ul>
            )}
            {/* jscpd:ignore-end */}
          </section>

          <section className={css.block}>
            {/* jscpd:ignore-start */}
            {working ? <p className={css.notice}>{t('working')}</p> : null}
            {outcome?.kind === 'saved' ? <p className={css.done}>{t('savedDone', { name: outcome.displayName })}</p> : null}
            {outcome?.kind === 'removed' ? <p className={css.done}>{t('removedDone')}</p> : null}
            {outcome?.kind === 'bound' ? <p className={css.done}>{t('boundDone', { subject: outcome.subject })}</p> : null}
            {outcome?.kind === 'unbound' ? <p className={css.done}>{t('unboundDone')}</p> : null}
            {outcome?.kind === 'refused' ? <p className={css.refused}>{t('refused', { reason: outcome.reason })}</p> : null}
            <PersonForm
              // Remounted per edited person so the form starts from their own
              // values rather than from whatever was typed last.
              key={editingId ?? 'new'}
              editing={editing}
              working={working}
              marked={marked}
              save={save}
              t={t}
            />
            {editing === undefined ? null : (
              <AdmitForm person={editing} channels={channels} working={working} bind={bind} t={t} />
            )}
            {/* jscpd:ignore-end */}
          </section>
        </>
      )}

      {/* jscpd:ignore-start */}
      {removing === undefined ? null : (
        <RiskConfirmation
          open
          title={t('removeTitle', { name: removing.displayName })}
          description={t('removeBody')}
          acknowledgeLabel={t('removeAcknowledge')}
          cancelLabel={t('removeCancel')}
          closeLabel={t('close')}
          confirmLabel={t('removeConfirm')}
          acknowledged={acknowledged}
          disabled={working}
          onAcknowledgedChange={setAcknowledged}
          onCancel={() => { setRemoving(undefined); setAcknowledged(false) }}
          onConfirm={() => { confirmRemoval(removing) }}
        />
      )}
      {/* jscpd:ignore-end */}
    </div>
  )
}
