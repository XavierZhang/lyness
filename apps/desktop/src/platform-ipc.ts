/** Shared names for the desktop Platform bridge. */
/** Private desktop channels; the Platform renderer receives bootstrap and locale updates. */
export const PLATFORM_IPC = {
  bootstrap: 'lyn-platform:bootstrap',
  localeChanged: 'lyn-platform:locale-changed',
  open: 'lyn-platform:open',
  bounds: 'lyn-platform:bounds',
  close: 'lyn-platform:close',
} as const

/** Resolved Platform language; Desktop resolves the system preference before sending it. */
export type PlatformLocale = 'en_US' | 'zh_CN'
