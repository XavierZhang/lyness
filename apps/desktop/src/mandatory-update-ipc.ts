/** Dependency-free IPC names shared with the sandboxed mandatory-update preload. */
export const MANDATORY_IPC = {
  status: 'lyn-desktop:mandatory-status', state: 'lyn-desktop:mandatory-state', action: 'lyn-desktop:mandatory-action',
} as const
