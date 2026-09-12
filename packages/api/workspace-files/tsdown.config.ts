import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)
