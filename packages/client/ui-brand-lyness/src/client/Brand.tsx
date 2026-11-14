import type { HeroBrandMarkOwnerProps } from '@lyness/lyn-client-ui-conversation/client'
import type { PropsLocale } from '@lyness/lyn-client-ui-slots'
import type { SidebarAttributionOwnerProps, SidebarBrandMarkOwnerProps } from '@lyness/lyn-client-ui-sidebar/client'
import { MARK_PATHS, MARK_VIEWBOX, WORDMARK_HEIGHT, WORDMARK_PATH, WORDMARK_WIDTH } from './artwork.ts'
import { readDeploymentBrand } from './deployment-brand.ts'
import css from './Brand.module.css'

/** The attribution occupant's props: the sidebar's column state and its own copy. */
type AttributionProps = SidebarAttributionOwnerProps & PropsLocale<'brandAttribution'>

interface BrandMarkProps {
  size: number
  className?: string | undefined
}

/** The deployment mark when the page carries one, otherwise the lyness mark, fitted to a `size` square. */
function BrandMark({ size, className }: BrandMarkProps) {
  const { markUrl } = readDeploymentBrand()
  if (markUrl !== undefined) {
    return <img src={markUrl} alt="" width={size} height={size} className={className} style={{ objectFit: 'contain' }} />
  }
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} fill="currentColor" className={className} aria-hidden="true">
      {MARK_PATHS.map(d => <path key={d} d={d} />)}
    </svg>
  )
}

/**
 * Render the sidebar mark at the size the sidebar requests.
 * @param props - Host-supplied mark presentation.
 * @returns the deployment mark or the lyness mark.
 */
export function LynessSidebarMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandMark size={size} />
}

/**
 * Render the conversation hero mark with the hero's size and class.
 * @param props - Host-supplied mark presentation.
 * @returns the deployment mark or the lyness mark.
 */
export function LynessHeroMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <BrandMark size={size} className={className} />
}

/**
 * Render the sidebar name: the deployment wordmark, else the deployment
 * product name as text, else the lyness wordmark.
 * @returns the name artwork or text.
 */
export function LynessSidebarName() {
  const { productName, wordmarkUrl } = readDeploymentBrand()
  if (wordmarkUrl !== undefined) return <img src={wordmarkUrl} alt="" height={WORDMARK_HEIGHT} />
  if (productName !== undefined) return <span>{productName}</span>
  return (
    <svg
      width={WORDMARK_WIDTH}
      height={WORDMARK_HEIGHT}
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={WORDMARK_PATH} />
    </svg>
  )
}

/**
 * Render the attribution line, which names the platform this deployment runs
 * on rather than the deployment's own brand.
 *
 * A deployment that shows none renders nothing, so the sidebar foot keeps its
 * height. The collapsed rail has no room for a sentence, so the line waits for
 * the wide column.
 * @param props - the sidebar's column state and this occupant's translate seat.
 * @returns the line, or nothing when this deployment shows none.
 */
export function LynessAttribution({ wide, t }: AttributionProps) {
  if (!wide || !readDeploymentBrand().showPoweredBy) return null
  return <span className={css.attribution}>{t('poweredBy')}</span>
}
