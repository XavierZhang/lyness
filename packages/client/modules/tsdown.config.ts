import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@lyness/client-modules',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
