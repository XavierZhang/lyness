import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-api-terminal-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
