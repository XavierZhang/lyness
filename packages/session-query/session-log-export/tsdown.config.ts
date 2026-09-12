import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
