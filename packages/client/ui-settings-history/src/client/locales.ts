/**
 * Copy for the history section: what administrators changed, who changed it,
 * and what the change replaced.
 *
 * @module @lyness/lyn-client-ui-settings-history/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  nav: 'History',
  title: 'Administrative history',
  intro: 'Every change made to the people, the directory identities admitted as them, the bots and the teams — with who made it and what it replaced. Entries are only ever added, and nobody can edit or remove one.',
  loading: 'Loading the history…',
  failed: 'The history could not be read. Please try again.',
  retry: 'Try again',
  unavailable: 'This deployment keeps no administrative history.',
  forbidden: 'Only an administrator can read the history of this organization.',
  none: 'Nothing has been changed yet.',
  refresh: 'Refresh',
  by: 'by',
  kindPerson: 'Person',
  kindBinding: 'Sign-in identity',
  kindBot: 'Bot',
  kindTeam: 'Team',
  actionAdded: 'added',
  actionChanged: 'changed',
  actionRemoved: 'removed',
  fieldWas: 'was',
  fieldNow: 'now',
  fieldEmpty: '(empty)',
  truncated: 'Shortened',
  truncatedHint: 'This deployment keeps only the first part of a long value.',
  redacted: 'Replaced',
  redactedHint: 'A credential was replaced. The history records that it changed and never what it is.',
  noFields: 'No field was recorded for this change.',
  organization: 'Organization',
  subjectId: 'Record id',
  pageHint: 'The newest entries this deployment answers with. Older ones are kept and are not shown here yet.',
}

/** The keys this section's copy is addressed by. */
export type HistoryKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<HistoryKey, string> = {
  nav: '历史',
  title: '管理历史',
  intro: '对人、以他们名义登录的那些目录身份、bot 和团队所做的每一次更改——带上是谁做的，以及那次更改替换掉了什么。条目只会被添加，谁也不能编辑或删除某一条。',
  loading: '正在读取历史……',
  failed: '读不到历史。请再试一次。',
  retry: '再试一次',
  unavailable: '这个部署不保留管理历史。',
  forbidden: '只有管理员能读这个组织的历史。',
  none: '还什么都没有改过。',
  refresh: '刷新',
  by: '操作人',
  kindPerson: '人',
  kindBinding: '登录身份',
  kindBot: '机器人',
  kindTeam: '团队',
  actionAdded: '已添加',
  actionChanged: '已修改',
  actionRemoved: '已移除',
  fieldWas: '原为',
  fieldNow: '现为',
  fieldEmpty: '（空）',
  truncated: '已截断',
  truncatedHint: '这个部署只保留长内容的前一部分。',
  redacted: '已更换',
  redactedHint: '一个凭据被更换了。历史记下它变了，从不记下它是什么。',
  noFields: '这次更改没有记下任何字段。',
  organization: '组织',
  subjectId: '记录 id',
  pageHint: '这是这个部署答得出的那些最新条目。更早的仍然保留着，只是这里还不展示。',
}
