/** Public contact options shared by Host and Client. */
import z from '@deepseek-ai/schemastery'

/** Questionnaire destination shared by Host and Client. */
export interface ContactConfig {
  /**
   * HTTPS questionnaire the Feedback entry opens, or empty for none.
   *
   * Empty by default, and empty means the entry is not offered: the URL
   * carries the signed-in account, the build and the device to whoever owns
   * the form, so a deployment names its own or asks nothing.
   */
  contactFormUrl: string
  /** Questionnaire source option; empty until Harness is supported by the form. */
  contactSource: string
}
/** Validate public questionnaire options. */
export const ContactConfigFields = {
  contactFormUrl: z.string().pattern(/^(?:https:\/\/[^/\s]+\/.*)?$/).default(''),
  contactSource: z.string().default(''),
}
/** Validate public questionnaire options. */
export const ContactConfig: z<Partial<ContactConfig>, ContactConfig> = z.object(ContactConfigFields)
/** Bootstrap key containing no account credentials. */
export const CONTACT_CONFIG_GLOBAL = '__DSH_CONTACT_CONFIG__'
