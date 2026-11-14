/**
 * Public package manifest and plugin display types, with no runtime exports.
 * @module @lyness/lyn-package-manifest
 */

export type {
  ClientModuleStylesheetDescriptor,
  ClientModuleStyleContext,
  ClientModuleMeta,
  ClientModuleMetaFactory,
  ClientBundleRequire,
  ClientModuleFactory,
  LynClientModuleManifest,
} from './client-module.ts'

export type {
  LynBundleManifest,
  LynClientManifest,
  LynEnginesManifest,
  LynManifest,
  LynPackageManifest,
  LynProfileManifest,
  LocalizedText,
  PluginLocalizedMeta,
} from './types.ts'
