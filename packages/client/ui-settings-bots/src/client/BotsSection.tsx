/**
 * The bots section in Settings: which bots an organization runs, what each
 * one is for, and what it runs with.
 *
 * A bot composition wrote is shown and not offered for editing: the
 * installation's files name it, so the next boot would undo a change made
 * here. One whose preset the deployment no longer offers is shown too, and
 * marked, because the character an administrator wrote outlives the row that
 * ran it.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button, Checkbox, Input, RiskConfirmation, SegmentedControl, Tag } from '@lyness/lyn-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {
  BotInput, BotRowView, PresetOptionView, TeamInput, TeamRowView,
} from '@lyness/lyn-api-bots-controller/types'
import type { createBotsSectionStore } from './store.ts'
import css from './BotsSection.module.css'

/** Injected business face: the read, the retry, and the two changes. */
export interface BotsSectionInjected {
  /** Read the bots and the presets, or join the read already running. */
  load: () => Promise<void>
  /** Open a new conversation with one bot, in the Workspace the reader is in. */
  talk: (id: string) => void
  /** Read again after a failure. */
  retry: () => Promise<void>
  /** Add one bot, or change one. */
  save: (input: BotInput) => Promise<void>
  /** Remove one bot. */
  remove: (id: string) => Promise<void>
  /** Add one team, or change one. */
  saveTeam: (input: TeamInput) => Promise<void>
  /** Remove one team. */
  removeTeam: (id: string) => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type BotsSectionProps =
  PropsRuntime<'settings.administration.section'> & PropsStore<ReturnType<typeof createBotsSectionStore>>
  & PropsLocale<'settings.bots'> & BotsSectionInjected

/** The translator this section's parts are handed. */
type Translate = PropsLocale<'settings.bots'>['t']

/**
 * What one preset is called.
 * @param preset - the preset as the wire names it.
 * @returns the reader's label for it, which falls back to the id.
 */
function presetLabel(preset: PresetOptionView): string {
  return preset.displayName ?? preset.id
}

/**
 * Render one bot.
 * @param props - the bot, what to call things, and the things to do with it.
 * @returns the row element tree.
 */
function BotRow({ bot, editing, t, onTalk, onEdit, onRemove }: {
  bot: BotRowView
  editing: boolean
  t: Translate
  onTalk: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowName}>{bot.displayName}</span>
        {bot.written ? <Tag tone="neutral">{t('fromConfiguration')}</Tag> : null}
        {bot.available ? null : <Tag tone="warning">{t('unavailableBot')}</Tag>}
      </div>
      <div className={css.rowFacts}>
        <span className={css.rowScope}>{bot.organization}</span>
        <span className={css.rowKind}>{t('runsWith')}</span>
        <span className={css.rowScope}>{bot.preset}</span>
      </div>
      {bot.job === '' ? null : <p className={css.rowJob}>{bot.job}</p>}
      {bot.written ? <p className={css.rowHint}>{t('fromConfigurationHint')}</p> : null}
      {bot.available ? null : (
        <p className={css.rowHint}>{`${t('unavailableBotHint')} ${t('talkUnavailable')}`}</p>
      )}
      <p className={css.rowId}>
        <span>{t('botId')}</span>
        <code className={css.rowIdValue}>{bot.id}</code>
        <span className={css.rowHint}>{t('botIdHint')}</span>
      </p>
      <div className={css.rowActions}>
        {/* Offered for a written bot too: the operator's own bots are the
            ones most worth talking to, and only changing them is refused. */}
        <Button variant="primary" disabled={!bot.available} onClick={onTalk}>{t('talk')}</Button>
        {/* jscpd:ignore-start */}
        {bot.written ? null : (
          <>
            <Button variant="outline" onClick={onEdit}>{editing ? t('cancelEdit') : t('edit')}</Button>
            <Button variant="outline" onClick={onRemove}>{t('remove')}</Button>
          </>
        )}
        {/* jscpd:ignore-end */}
      </div>
    </li>
  )
}

/**
 * Render the add-or-edit bot form.
 * @param props - which bot is being edited, what it may be given, and what to do on submit.
 * @returns the form element tree.
 */
function BotForm({ editing, presets, working, marked, save, t }: {
  editing: BotRowView | undefined
  presets: readonly PresetOptionView[]
  working: boolean
  marked: readonly string[]
  save: (input: BotInput) => Promise<void>
  t: Translate
}) {
  const fallback = presets[0]?.id ?? ''
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '')
  const [organization, setOrganization] = useState(editing?.organization ?? '')
  const [persona, setPersona] = useState(editing?.persona ?? '')
  const [job, setJob] = useState(editing?.job ?? '')
  const [preset, setPreset] = useState(editing?.preset ?? fallback)

  // The form follows what it is editing: picking another row, or leaving edit
  // mode, must not leave the previous bot's values in the fields.
  useEffect(() => {
    setDisplayName(editing?.displayName ?? '')
    setOrganization(editing?.organization ?? '')
    setPersona(editing?.persona ?? '')
    setJob(editing?.job ?? '')
    setPreset(editing?.preset ?? fallback)
  }, [editing, fallback])

  const submit = useCallback((): void => {
    if (displayName.trim().length === 0 || preset === '') return
    void save({
      ...editing === undefined ? {} : { id: editing.id },
      displayName: displayName.trim(),
      organization: organization.trim(),
      persona,
      job: job.trim(),
      preset,
    })
  }, [displayName, editing, job, organization, persona, preset, save])

  if (presets.length === 0) return <p className={css.notice}>{t('presetEmpty')}</p>

  return (
    /* jscpd:ignore-start */
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h4 className={css.formHeading}>
        {editing === undefined ? t('addHeading') : t('editHeading', { name: editing.displayName })}
      </h4>
      {/* The markup of a Settings form field, and of the add-or-edit heading
          above it. Deliberately parallel to the people and channels
          sections: what repeats is the shape, while the copy, the fields and
          what each one decides are this section's own. */}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('displayName')}</span>
        <Input value={displayName} onChange={(event) => { setDisplayName(event.target.value) }} />
        <span className={css.fieldHint}>{t('displayNameHint')}</span>
      </label>
      <label className={marked.includes('organization') ? css.fieldMarked : css.field}>
        <span className={css.fieldLabel}>{t('organization')}</span>
        <Input value={organization} onChange={(event) => { setOrganization(event.target.value) }} />
        <span className={css.fieldHint}>{t('organizationHint')}</span>
      </label>
      {/* jscpd:ignore-end */}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('personaLabel')}</span>
        <textarea
          className={css.persona}
          value={persona}
          onChange={(event) => { setPersona(event.target.value) }}
        />
        <span className={css.fieldHint}>{t('personaHint')}</span>
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('job')}</span>
        <textarea
          className={css.persona}
          value={job}
          onChange={(event) => { setJob(event.target.value) }}
        />
        <span className={css.fieldHint}>{t('jobHint')}</span>
      </label>
      <SegmentedControl
        id="settings-bots-preset"
        value={preset}
        label={t('preset')}
        options={presets.map(one => ({ value: one.id, label: presetLabel(one) }))}
        onChange={setPreset}
      />
      <span className={css.fieldHint}>{t('presetHint')}</span>
      <Button type="submit" variant="primary" disabled={working}>
        {editing === undefined ? t('submitNew') : t('submitEdit')}
      </Button>
    </form>
  )
}

/**
 * Render one team.
 * @param props - the team, the bots it may name, and the things to do with it.
 * @returns the row element tree.
 */
function TeamRow({ team, bots, editing, t, onEdit, onRemove }: {
  team: TeamRowView
  bots: readonly BotRowView[]
  editing: boolean
  t: Translate
  onEdit: () => void
  onRemove: () => void
}) {
  const names = team.members
    .map(member => bots.find(one => one.id === member)?.displayName)
    .filter((name): name is string => name !== undefined)
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowName}>{team.displayName}</span>
        {team.written ? <Tag tone="neutral">{t('fromConfiguration')}</Tag> : null}
      </div>
      <div className={css.rowFacts}>
        <span className={css.rowKind}>{t('teamMembers')}</span>
        <span className={css.rowScope}>{names.length === 0 ? t('teamMembersNone') : names.join('、')}</span>
      </div>
      {team.written ? <p className={css.rowHint}>{t('fromConfigurationHint')}</p> : null}
      {team.written ? null : (
        <div className={css.rowActions}>
          <Button variant="outline" onClick={onEdit}>{editing ? t('cancelEdit') : t('edit')}</Button>
          <Button variant="outline" onClick={onRemove}>{t('removeTeam')}</Button>
        </div>
      )}
    </li>
  )
}

/**
 * Render the create-or-edit team form.
 * @param props - which team is being edited, the bots it may hold, and what to do on submit.
 * @returns the form element tree.
 */
function TeamForm({ editing, bots, working, marked, save, t }: {
  editing: TeamRowView | undefined
  bots: readonly BotRowView[]
  working: boolean
  marked: readonly string[]
  save: (input: TeamInput) => Promise<void>
  t: Translate
}) {
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '')
  const [organization, setOrganization] = useState(editing?.organization ?? bots[0]?.organization ?? '')
  const [members, setMembers] = useState<readonly string[]>(editing?.members ?? [])

  // The form follows what it is editing, the way the bot form does.
  useEffect(() => {
    setDisplayName(editing?.displayName ?? '')
    setOrganization(editing?.organization ?? bots[0]?.organization ?? '')
    setMembers(editing?.members ?? [])
  }, [bots, editing])

  const submit = useCallback((): void => {
    if (displayName.trim().length === 0) return
    void save({
      ...editing === undefined ? {} : { id: editing.id },
      displayName: displayName.trim(),
      organization: organization.trim(),
      members: [...members],
    })
  }, [displayName, editing, members, organization, save])

  // A team holds only its own organization's bots, so the member list is the
  // bots this reader already maintains rather than a free-text field.
  if (bots.length === 0) return <p className={css.notice}>{t('teamNoBots')}</p>

  return (
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h4 className={css.formHeading}>
        {editing === undefined ? t('addTeamHeading') : t('editTeamHeading', { name: editing.displayName })}
      </h4>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('teamName')}</span>
        <Input value={displayName} onChange={(event) => { setDisplayName(event.target.value) }} />
        <span className={css.fieldHint}>{t('teamNameHint')}</span>
      </label>
      <label className={marked.includes('organization') ? css.fieldMarked : css.field}>
        <span className={css.fieldLabel}>{t('organization')}</span>
        <Input value={organization} onChange={(event) => { setOrganization(event.target.value) }} />
        <span className={css.fieldHint}>{t('organizationHint')}</span>
      </label>
      <div className={css.field}>
        <span className={css.fieldLabel}>{t('teamMembers')}</span>
        <ul className={css.members}>
          {bots.map(one => (
            <li className={css.member} key={one.id}>
              <Checkbox
                checked={members.includes(one.id)}
                label={one.displayName}
                onChange={(next) => {
                  setMembers(current => next
                    ? [...current, one.id]
                    : current.filter(member => member !== one.id))
                }}
              />
            </li>
          ))}
        </ul>
        <span className={css.fieldHint}>{t('teamMembersHint')}</span>
      </div>
      <Button type="submit" variant="primary" disabled={working}>
        {editing === undefined ? t('submitNewTeam') : t('submitEditTeam')}
      </Button>
    </form>
  )
}

/**
 * Render the bots section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function BotsSection({
  t, useStore, load, retry, talk, save, remove, saveTeam, removeTeam,
}: BotsSectionProps) {
  const status = useStore(state => state.status)
  const bots = useStore(state => state.bots)
  const presets = useStore(state => state.presets)
  const teams = useStore(state => state.teams)
  const working = useStore(state => state.working)
  const outcome = useStore(state => state.outcome)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [removing, setRemoving] = useState<BotRowView | undefined>(undefined)
  const [acknowledged, setAcknowledged] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | undefined>(undefined)
  const [removingTeam, setRemovingTeam] = useState<TeamRowView | undefined>(undefined)
  const [teamAcknowledged, setTeamAcknowledged] = useState(false)

  // The read starts when the section opens rather than at plugin load: a
  // reader who never opens this should not cost the deployment a request.
  useEffect(() => { void load() }, [load])

  const editing = bots.find(one => one.id === editingId)
  const editingTeam = teams.find(one => one.id === editingTeamId)
  const marked = outcome?.kind === 'refused' ? outcome.fields : []

  /* jscpd:ignore-start */
  const confirmRemoval = useCallback((target: BotRowView): void => {
    setRemoving(undefined)
    setAcknowledged(false)
    // The row being edited is the row being removed often enough to matter:
    // leaving edit mode on it would otherwise show a form for a bot that no
    // longer exists.
    if (target.id === editingId) setEditingId(undefined)
    void remove(target.id)
  }, [editingId, remove])
  /* jscpd:ignore-end */

  return (
    <div className={css.section}>
      {/* jscpd:ignore-start */}
      {/* The shape of a Settings section that reads from the deployment: a
          title, an intro, one notice per state the read can be in, and the
          roster it shows once the read answered. Each section owns its own
          copy and its own CSS module, so what repeats here is the shape
          rather than anything that could be shared. */}
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
            <h3 className={css.blockHeading}>{t('roster')}</h3>
            {bots.length === 0 ? <p className={css.notice}>{t('none')}</p> : (
              <ul className={css.rows}>
                {bots.map(bot => (
                  <BotRow
                    key={bot.id}
                    bot={bot}
                    editing={bot.id === editingId}
                    t={t}
                    onTalk={() => { talk(bot.id) }}
                    onEdit={() => { setEditingId(bot.id === editingId ? undefined : bot.id) }}
                    onRemove={() => { setRemoving(bot); setAcknowledged(false) }}
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
            {outcome?.kind === 'team-saved' ? <p className={css.done}>{t('teamSavedDone', { name: outcome.displayName })}</p> : null}
            {outcome?.kind === 'team-removed' ? <p className={css.done}>{t('teamRemovedDone')}</p> : null}
            {outcome?.kind === 'refused' ? <p className={css.refused}>{t('refused', { reason: outcome.reason })}</p> : null}
            {/* jscpd:ignore-end */}
            <BotForm
              // Remounted per edited bot so the form starts from its own
              // values rather than from whatever was typed last.
              key={editingId ?? 'new'}
              editing={editing}
              presets={presets}
              working={working}
              marked={marked}
              save={save}
              t={t}
            />
          </section>

          <section className={css.block}>
            <h3 className={css.blockHeading}>{t('teams')}</h3>
            <p className={css.intro}>{t('teamsIntro')}</p>
            {teams.length === 0 ? <p className={css.notice}>{t('teamsNone')}</p> : (
              <ul className={css.rows}>
                {teams.map(team => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    bots={bots}
                    editing={team.id === editingTeamId}
                    t={t}
                    onEdit={() => { setEditingTeamId(team.id === editingTeamId ? undefined : team.id) }}
                    onRemove={() => { setRemovingTeam(team); setTeamAcknowledged(false) }}
                  />
                ))}
              </ul>
            )}
            <TeamForm
              key={editingTeamId ?? 'new-team'}
              editing={editingTeam}
              bots={bots}
              working={working}
              marked={marked}
              save={saveTeam}
              t={t}
            />
          </section>
        </>
      )}

      {removingTeam === undefined ? null : (
        <RiskConfirmation
          open
          title={t('removeTeamTitle', { name: removingTeam.displayName })}
          description={t('removeTeamBody')}
          acknowledgeLabel={t('removeTeamAcknowledge')}
          cancelLabel={t('removeCancel')}
          closeLabel={t('close')}
          confirmLabel={t('removeTeamConfirm')}
          acknowledged={teamAcknowledged}
          disabled={working}
          onAcknowledgedChange={setTeamAcknowledged}
          onCancel={() => { setRemovingTeam(undefined); setTeamAcknowledged(false) }}
          onConfirm={() => {
            const target = removingTeam
            setRemovingTeam(undefined)
            setTeamAcknowledged(false)
            if (target.id === editingTeamId) setEditingTeamId(undefined)
            void removeTeam(target.id)
          }}
        />
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
