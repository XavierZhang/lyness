import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/api-remotes',
  ['lib/types/index.js'],
  { hostPhase: true },
)
