import { createSnapshotStore, type SnapshotStore } from '@lyness/lyn-client-store'

/** Remember the dismissed creation notice across sessions in this browser.
 * @returns a plugin-owned preference; unavailable storage only disables persistence.
 */
export function createCreationInfoStore(): SnapshotStore<boolean> {
  return createSnapshotStore(false, { persist: { name: 'lyn.creation-recommendations.info-dismissed' } })
}
