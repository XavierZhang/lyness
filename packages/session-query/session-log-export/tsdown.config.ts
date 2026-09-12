import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
