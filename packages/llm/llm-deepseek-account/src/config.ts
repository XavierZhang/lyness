/** Account providers expose protocol settings without an API-key reference. */
import { Config as ProtocolConfig } from '@lyness/lyn-llm-deepseek'

/** Account route configuration; authentication comes exclusively from the account service. */
export type Config = ProtocolConfig
export const Config = ProtocolConfig
