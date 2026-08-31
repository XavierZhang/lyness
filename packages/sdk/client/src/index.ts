/**
 * TypeScript client SDK for the lyness runtime: spawn the
 * same-version `lyn --profile sdk` runtime as a subprocess and drive agent
 * turns over stdio JSON-RPC. `Lyness` is the high-level run API;
 * `HarnessClient` is the lower-level protocol client. A pure library — it
 * registers nothing on a Cordis context; named profiles and ordered patch
 * files customize the runtime process it spawns.
 *
 * @module @lyness/sdk-client
 */

export { Lyness, HarnessSession } from './api.ts'
export type { RunOptions } from './api.ts'
export {
  HarnessClient,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from './client.ts'
export type { NotificationSubscription } from './client.ts'
export { JsonRpcResponseError } from '@lyness/sdk-protocol'
export type {
  ContentBlock,
  SdkPromptContentBlock,
  LynessOptions,
  HarnessClientOptions,
  HarnessNotification,
  NotificationFilter,
  RunResult,
} from './types.ts'
