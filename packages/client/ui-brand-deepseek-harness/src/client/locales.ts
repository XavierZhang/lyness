/** `brandAttribution` namespace dictionaries. */

/**
 * Simplified Chinese dictionary (the key-set source of truth).
 *
 * The platform's own name is written here rather than filled from a brand
 * placeholder: this line names what the deployment is built on, so it stays
 * DeepSeek Harness in a deployment that renamed everything else.
 */
export const zh = {
  poweredBy: '由领驭提供技术支持',
} satisfies Record<string, string>

/** The attribution namespace key union. */
export type BrandAttributionKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The attribution line naming the platform a deployment runs on. */
    brandAttribution: BrandAttributionKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  poweredBy: 'Powered by DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** Japanese dictionary. The platform name stays literal here, as above. */
export const ja = {
  poweredBy: 'Powered by DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** Spanish dictionary. */
export const es = {
  poweredBy: 'Con tecnología de DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** French dictionary. */
export const fr = {
  poweredBy: 'Propulsé par DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** German dictionary. */
export const de = {
  poweredBy: 'Betrieben mit DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** Russian dictionary. */
export const ru = {
  poweredBy: 'Работает на DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>

/** Portuguese dictionary. */
export const pt = {
  poweredBy: 'Com tecnologia DeepSeek Harness',
} satisfies Record<BrandAttributionKey, string>
