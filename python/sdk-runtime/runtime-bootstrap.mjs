#!/usr/bin/env node
/** Private entry owned by the Python single-file runtime packaging. */
import { registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { isSea } from 'node:sea'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (isSea()) {
  // Office spawns executable helpers and URL workers; its complete package tree must be real files.
  const parentURL = pathToFileURL(`${process.execPath.replace(/\.exe$/i, '')}-office/package.json`).href
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const office = specifier === '@lyness/libreoffice-kit' || specifier === '@lyness/libreoffice-kit/package.json'
      return nextResolve(specifier, office ? { ...context, parentURL } : context)
    },
  })
}

const selectorName = 'LYNESS_SUBPROCESS_RUNNER'
const selection = process.env[selectorName]
const aclRunner = process.platform === 'win32'
  ? fileURLToPath(import.meta.resolve('@lyness/lyn-sandbox-windows-acl/runner'))
  : undefined

if (aclRunner !== undefined && process.argv[2] === aclRunner) {
  process.argv.splice(1, 1)
  await import('@lyness/lyn-sandbox-windows-acl/runner')
} else if (process.env.LYNESS_PTC_RUNTIME_NODE === '1') {
  Reflect.deleteProperty(process.env, 'LYNESS_PTC_RUNTIME_NODE')
  await import('@lyness/lyn-ptc-runtime-node/process')
} else if (selection === undefined) {
  if (isSea()) {
    // Carrier default stays separate so process/home environment and profile patches can override it.
    const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'win' : process.platform
    process.env.LYNESS_BUNDLED_PRIMARY_RUNTIME = join(dirname(process.execPath), `${platform}-${process.arch}`, 'primary-runtime')
  }
  const { runCli } = await import('@lyness/lyn/lib/bin.js')
  await runCli()
} else {
  Reflect.deleteProperty(process.env, selectorName)
  const { runSelectedSubprocessRunner } = await import('@lyness/lyn-subprocess-local/runner')
  await runSelectedSubprocessRunner(selection)
}
