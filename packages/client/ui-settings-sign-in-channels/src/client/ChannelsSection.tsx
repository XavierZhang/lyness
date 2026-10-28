/**
 * The sign-in channels section in Settings: what this deployment, or this
 * tenant, signs its people in with, and the form that changes it.
 *
 * The form's fields come from the kind the administrator picked, so a surface
 * never asks for a setting the directory does not take, and never omits one
 * it requires.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, RiskConfirmation, SegmentedControl, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  ChannelInput, ChannelKindView, ConfiguredChannelView,
} from '@deepseek-ai/dsh-api-sign-in-channel-controller/types'
import type { createChannelsSectionStore } from './store.ts'
import css from './ChannelsSection.module.css'

/** Injected business face: the read, the retry, and the two changes. */
export interface ChannelsSectionInjected {
  /** Read the kinds and the records, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Create one channel, or replace one that exists. */
  save: (input: ChannelInput) => Promise<void>
  /** Remove one channel. */
  remove: (id: string) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type ChannelsSectionProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createChannelsSectionStore>>
  & PropsLocale<'settings.sign-in-channels'> & ChannelsSectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.sign-in-channels'>['t']

/**
 * Render one configured channel.
 * @param props - the channel, what to call it, and the two things to do with it.
 * @returns the row element tree.
 */
function ChannelRow({ channel, kinds, editing, t, onEdit, onRemove }: {
  channel: ConfiguredChannelView
  kinds: readonly ChannelKindView[]
  editing: boolean
  t: Translate
  onEdit: () => void
  onRemove: () => void
}) {
  // A record whose kind this composition no longer mounts still says which
  // kind it was configured as, rather than showing nothing.
  const kind = kinds.find(one => one.id === channel.kind)?.displayName ?? channel.kind
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowName}>{channel.displayName}</span>
        <Tag tone={channel.mounted ? 'success' : 'warning'}>
          {channel.mounted ? t('serving') : t('notServing')}
        </Tag>
      </div>
      <div className={css.rowFacts}>
        <span className={css.rowKind}>{kind}</span>
        <span className={css.rowScope}>
          {channel.organization === undefined ? t('deploymentWide') : channel.organization}
        </span>
        <span className={css.rowWhen}>
          {t('configuredAt', {
            at: new Date(channel.configuredAt).toLocaleDateString(),
            person: channel.configuredBy,
          })}
        </span>
      </div>
      {channel.mounted ? null : <p className={css.rowHint}>{t('notServingHint')}</p>}
      <p className={css.rowId}>
        <span>{t('channelId')}</span>
        <code className={css.rowIdValue}>{channel.id}</code>
        <span className={css.rowHint}>{t('channelIdHint')}</span>
      </p>
      <div className={css.rowActions}>
        <Button variant="outline" onClick={onEdit}>{editing ? t('cancelEdit') : t('edit')}</Button>
        <Button variant="outline" onClick={onRemove}>{t('remove')}</Button>
      </div>
    </li>
  )
}

/**
 * The settings one kind takes, as the form holds them.
 * @param kind - the kind the administrator picked.
 * @param from - what the channel being edited already has.
 * @returns one entry per field the kind declares.
 */
function settingsOf(
  kind: ChannelKindView | undefined,
  from: ConfiguredChannelView | undefined,
): Record<string, string> {
  const held: Record<string, string> = {}
  for (const field of kind?.fields ?? []) held[field.name] = from?.settings[field.name] ?? ''
  return held
}

/**
 * Render the add-or-edit form.
 * @param props - the kinds, the channel being edited, and what to do on submit.
 * @returns the form element tree.
 */
function ChannelForm({ kinds, editing, working, marked, save, t }: {
  kinds: readonly ChannelKindView[]
  editing: ConfiguredChannelView | undefined
  working: boolean
  marked: readonly string[]
  save: (input: ChannelInput) => Promise<void>
  t: Translate
}) {
  const first = kinds[0]?.id ?? ''
  const [kindId, setKindId] = useState(editing?.kind ?? first)
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '')
  const [organization, setOrganization] = useState(editing?.organization ?? '')
  const [scope, setScope] = useState<'deployment' | 'organization'>(
    editing?.organization === undefined ? 'deployment' : 'organization',
  )
  const [secret, setSecret] = useState('')
  const kind = useMemo(() => kinds.find(one => one.id === kindId), [kindId, kinds])
  const [settings, setSettings] = useState<Record<string, string>>(() => settingsOf(kind, editing))

  // The form follows what it is editing: picking another row, or leaving edit
  // mode, must not leave the previous channel's settings in the fields.
  useEffect(() => {
    const next = editing?.kind ?? first
    setKindId(next)
    setDisplayName(editing?.displayName ?? '')
    setOrganization(editing?.organization ?? '')
    setScope(editing?.organization === undefined ? 'deployment' : 'organization')
    setSecret('')
    setSettings(settingsOf(kinds.find(one => one.id === next), editing))
  }, [editing, first, kinds])

  const pickKind = useCallback((picked: string): void => {
    setKindId(picked)
    // Each kind takes its own settings; carrying the previous kind's values
    // across would submit a corpid as an app id.
    setSettings(settingsOf(kinds.find(one => one.id === picked), undefined))
  }, [kinds])

  const submit = useCallback((): void => {
    if (kind === undefined || displayName.trim().length === 0) return
    void save({
      ...editing === undefined ? {} : { id: editing.id },
      kind: kind.id,
      displayName: displayName.trim(),
      ...scope === 'organization' && organization.trim().length > 0
        ? { organization: organization.trim() }
        : {},
      settings,
      ...secret === '' ? {} : { secret },
    })
  }, [displayName, editing, kind, organization, save, scope, secret, settings])

  if (kinds.length === 0) return <p className={css.notice}>{t('kindEmpty')}</p>

  return (
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h4 className={css.formHeading}>
        {editing === undefined ? t('addHeading') : t('editHeading', { name: editing.displayName })}
      </h4>
      {editing === undefined ? (
        <SegmentedControl
          id="sign-in-channel-kind"
          value={kindId}
          label={t('kind')}
          options={kinds.map(one => ({ value: one.id, label: one.displayName }))}
          onChange={pickKind}
        />
      ) : (
        <p className={css.editingKind}>
          <span className={css.fieldLabel}>{t('kind')}</span>
          <Tag tone="neutral">{kind?.displayName ?? kindId}</Tag>
        </p>
      )}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('displayName')}</span>
        <Input value={displayName} onChange={(event) => { setDisplayName(event.target.value) }} />
        <span className={css.fieldHint}>{t('displayNameHint')}</span>
      </label>
      <SegmentedControl
        id="sign-in-channel-scope"
        value={scope}
        label={t('scope')}
        options={[
          { value: 'deployment', label: t('scopeDeployment') },
          { value: 'organization', label: t('scopeOrganization') },
        ]}
        onChange={setScope}
      />
      {scope === 'deployment' ? null : (
        <label className={css.field}>
          <span className={css.fieldLabel}>{t('organization')}</span>
          <Input value={organization} onChange={(event) => { setOrganization(event.target.value) }} />
          <span className={css.fieldHint}>{t('organizationHint')}</span>
        </label>
      )}
      {(kind?.fields ?? []).map(field => (
        <label className={marked.includes(field.name) ? css.fieldMarked : css.field} key={field.name}>
          <span className={css.fieldLabel}>{field.label}</span>
          <Input
            /* v8 ignore next -- settingsOf seeds one entry per field; the fallback answers the index signature. */
            value={settings[field.name] ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setSettings(held => ({ ...held, [field.name]: value }))
            }}
          />
          {field.required ? <span className={css.fieldHint}>{t('required')}</span> : null}
        </label>
      ))}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('secret')}</span>
        <Input type="password" value={secret} onChange={(event) => { setSecret(event.target.value) }} />
        <span className={css.fieldHint}>{editing === undefined ? t('secretHintNew') : t('secretHintEdit')}</span>
      </label>
      <Button type="submit" variant="primary" disabled={working}>
        {editing === undefined ? t('submitNew') : t('submitEdit')}
      </Button>
    </form>
  )
}

/**
 * Render the sign-in channels section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function ChannelsSection({ t, useStore, load, retry, save, remove }: ChannelsSectionProps) {
  const status = useStore(state => state.status)
  const kinds = useStore(state => state.kinds)
  const channels = useStore(state => state.channels)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [removing, setRemoving] = useState<ConfiguredChannelView | undefined>(undefined)
  const [acknowledged, setAcknowledged] = useState(false)

  // The read starts when the section opens rather than at plugin load: a
  // person who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  const editing = channels.find(one => one.id === editingId)
  const marked = outcome?.kind === 'refused' ? outcome.fields : []

  const confirmRemoval = useCallback((target: ConfiguredChannelView): void => {
    setRemoving(undefined)
    setAcknowledged(false)
    // The row being edited is the row being removed often enough to matter:
    // leaving edit mode on it would otherwise show a form for a channel that
    // no longer exists.
    if (target.id === editingId) setEditingId(undefined)
    void remove(target.id)
  }, [editingId, remove])

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
            <h3 className={css.blockHeading}>{t('configured')}</h3>
            {channels.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
              <ul className={css.rows}>
                {channels.map(channel => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    kinds={kinds}
                    editing={channel.id === editingId}
                    t={t}
                    onEdit={() => { setEditingId(channel.id === editingId ? undefined : channel.id) }}
                    onRemove={() => { setRemoving(channel); setAcknowledged(false) }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className={css.block}>
            {working ? <p className={css.notice}>{t('working')}</p> : null}
            {outcome?.kind === 'saved' ? <p className={css.done}>{t('savedDone', { name: outcome.displayName })}</p> : null}
            {outcome?.kind === 'removed' ? <p className={css.done}>{t('removedDone')}</p> : null}
            {outcome?.kind === 'refused' ? <p className={css.refused}>{t('refused', { reason: outcome.reason })}</p> : null}
            <ChannelForm
              // Remounted per edited channel so the form starts from that
              // channel's own values rather than from whatever was typed last.
              key={editingId ?? 'new'}
              kinds={kinds}
              editing={editing}
              working={working}
              marked={marked}
              save={save}
              t={t}
            />
          </section>
        </>
      )}

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
    </div>
  )
}
