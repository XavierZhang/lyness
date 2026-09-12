import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)
