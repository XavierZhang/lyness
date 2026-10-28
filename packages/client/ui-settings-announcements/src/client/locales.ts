/**
 * Copy for the announcements row and its reader.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-announcements/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  row: 'System announcements',
  open: 'View',
  title: 'System announcements',
  close: 'Close',
  empty: 'This deployment has published nothing yet.',
  loading: 'Loading announcements…',
  failed: 'The announcements could not be read. Please try again.',
  retry: 'Try again',
  releaseLabel: 'Release {version}',
  readMore: 'Full notes',
  latest: 'Latest: {title}',
  copy: 'Copy',
  copied: 'Copied',
  footnotes: 'Footnotes',
} as const

/** Key set of the announcements dictionaries. */
export type AnnouncementsKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<AnnouncementsKey, string> = {
  row: '系统公告',
  open: '查看',
  title: '系统公告',
  close: '关闭',
  empty: '这个部署还没有发布任何公告。',
  loading: '正在读取公告……',
  failed: '暂时无法读取公告，请重试。',
  retry: '重试',
  releaseLabel: '版本 {version}',
  readMore: '完整说明',
  latest: '最新：{title}',
  copy: '复制',
  copied: '已复制',
  footnotes: '脚注',
}
