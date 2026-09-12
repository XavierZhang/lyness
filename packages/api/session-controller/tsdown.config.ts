import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-api-session-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
