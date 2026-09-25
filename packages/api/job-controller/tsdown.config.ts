import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@lyness/lyn-api-job-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
