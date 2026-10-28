/** `brandAttribution` namespace dictionaries. */

/**
 * Simplified Chinese dictionary (the key-set source of truth).
 *
 * The platform's own name is written here rather than filled from a brand
 * placeholder: this line names what the deployment is built on, so it stays
 * lyness in a deployment that renamed everything else.
 */
export const zh = {
  poweredBy: '由领驭提供技术支持',
} satisfies Record<string, string>

/** The attribution namespace key union. */
export type BrandAttributionKey = keyof typeof zh

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The attribution line naming the platform a deployment runs on. */
    brandAttribution: BrandAttributionKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  poweredBy: 'Powered by lyness',
} satisfies Record<BrandAttributionKey, string>
