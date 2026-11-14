/** Initial module manifests; owned Client libraries are compiled before shell assembly. */
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as Cordis from '@lyness/cordis'
import * as Zod from 'zod'
import * as ReactVirtual from '@tanstack/react-virtual'
import * as ClientStore from '@lyness/lyn-client-store'
import * as UiSlots from '@lyness/lyn-client-ui-slots'
import * as UiPrimitives from '@lyness/lyn-client-ui-primitives'
import * as UiDockkit from '@lyness/lyn-client-ui-dockkit'
import type { LynClientModuleManifest } from '@lyness/lyn-package-manifest'
import { STATIC_MODULE_MANIFEST_EXPORT, type PlatformModule } from './platform.ts'

/** Read the manifest a `staticLinked` library exports beside its ordinary exports. */
function compiledModule(id: string, namespace: object): LynClientModuleManifest {
  const manifest: unknown = Reflect.get(namespace, STATIC_MODULE_MANIFEST_EXPORT)
  if (typeof manifest !== 'object' || manifest === null
    || !('id' in manifest) || manifest.id !== id
    || !('factory' in manifest) || typeof manifest.factory !== 'function'
    || ('meta' in manifest && manifest.meta !== undefined && typeof manifest.meta !== 'function')) {
    throw new Error(`web boot: ${id} must be built with staticLinked before shell assembly`)
  }
  return manifest as LynClientModuleManifest
}

function platform(id: string, exports: Record<string, unknown>): LynClientModuleManifest {
  return { id, factory: () => exports }
}

/**
 * Supply shared third-party identities and package-generated manifests through one protocol.
 * @returns Initial module registrations; JavaScript and metadata factories are not evaluated here.
 */
export function getStaticModules(): readonly LynClientModuleManifest[] {
  return Object.values({
    'react': platform('react', React),
    'react/jsx-runtime': platform('react/jsx-runtime', ReactJsxRuntime),
    'react-dom': platform('react-dom', ReactDom),
    'react-dom/client': platform('react-dom/client', ReactDomClient),
    '@lyness/cordis': platform('@lyness/cordis', Cordis),
    'zod': platform('zod', Zod),
    '@tanstack/react-virtual': platform('@tanstack/react-virtual', ReactVirtual),
    '@lyness/lyn-client-store': compiledModule('@lyness/lyn-client-store', ClientStore),
    '@lyness/lyn-client-ui-slots': compiledModule('@lyness/lyn-client-ui-slots', UiSlots),
    '@lyness/lyn-client-ui-primitives': compiledModule('@lyness/lyn-client-ui-primitives', UiPrimitives),
    '@lyness/lyn-client-ui-dockkit': compiledModule('@lyness/lyn-client-ui-dockkit', UiDockkit),
  } satisfies Record<PlatformModule, LynClientModuleManifest>)
}
