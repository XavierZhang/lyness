/**
 * The screen a deployment with accounts shows somebody who is not in one.
 *
 * It covers the product rather than sitting beside it, because every other
 * surface on the page is about to be refused: the Remote authority rule turns
 * away an unidentified call, and a product rendered under that is a page of
 * error states.
 *
 * Each channel is a link rather than a button that calls: signing in leaves
 * for the directory's own page, which no RPC can do.
 */

import { useEffect } from 'react'
import { Button } from '@lyness/lyn-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-layout/client'
import type { ChannelOfferView } from '@lyness/lyn-api-identity-controller/types'
import type { ViewerSnapshot } from '@lyness/lyn-client-ui-viewer/client'
import css from './SignInScreen.module.css'

/** Injected business face: the shared read, the retry, and the snapshot. */
export interface SignInScreenInjected {
  /** Read who the viewer is, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure. */
  retry: () => Promise<void>
  hooks: {
    /** The shared viewer snapshot, owned by the `uiViewer` service. */
    viewer: HostObservable<ViewerSnapshot>
  }
}

/** Full component props: runtime share + locale seat + injected face. */
export type SignInScreenProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'sign-in'> & InjectFace<SignInScreenInjected>

/**
 * Where a surface sends the browser to begin one channel's sign-in.
 * @param prefix - the deployment's sign-in prefix.
 * @param channel - the channel to begin.
 * @returns the path to navigate to.
 */
export function signInHref(prefix: string, channel: ChannelOfferView): string {
  return `${prefix}/${encodeURIComponent(channel.id)}`
}

/**
 * Render the sign-in screen, or nothing when this viewer needs none.
 * @param props - composed slot props.
 * @returns the screen element tree, or null.
 */
export function SignInScreen({ t, useViewer, load, retry }: SignInScreenProps) {
  const status = useViewer(state => state.status)
  const viewer = useViewer(state => state.viewer)

  // Asked as soon as the frame is up: every other surface's calls depend on
  // the answer, so waiting for an interaction would mean waiting through a
  // page of refusals.
  useEffect(() => { void load() }, [load])

  if (status === 'failed') {
    return (
      <div className={css.cover}>
        <div className={css.panel}>
          <p className={css.notice}>{t('failed')}</p>
          <Button variant="outline" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      </div>
    )
  }
  // A deployment with no accounts, and a viewer already in one, both see the
  // product. So does a viewer whose read has not answered yet: a screen that
  // flashed before every load would be worse than one that arrives late.
  if (viewer === undefined || !viewer.accounts || viewer.person !== undefined) return null

  const offered = viewer.channels.filter(channel => channel.redirect)
  return (
    <div className={css.cover}>
      <div className={css.panel}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.intro}>{t('intro')}</p>
        {offered.length === 0 ? <p className={css.notice}>{t('noChannels')}</p> : (
          <ul className={css.channels}>
            {offered.map(channel => (
              <li key={channel.id}>
                <a className={css.channel} href={signInHref(viewer.signInPrefix, channel)}>
                  {t('signInWith', { channel: channel.displayName })}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
