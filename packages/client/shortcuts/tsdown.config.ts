import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-client-shortcuts',
  ['lib/types/index.js', 'lib/types/protocol.js'],
  { hostPhase: true },
)
