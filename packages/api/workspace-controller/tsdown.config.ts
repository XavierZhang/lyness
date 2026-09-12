import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
