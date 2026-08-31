import { clientLibrary } from '../../client/tsdown.client.ts'

export default clientLibrary(
  '@lyness/client-test-runtime',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
