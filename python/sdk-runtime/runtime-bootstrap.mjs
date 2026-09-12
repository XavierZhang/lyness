#!/usr/bin/env node
/** Private entry owned by the Python single-file runtime packaging. */

const selectorName = 'LYNESS_SUBPROCESS_RUNNER'
const selection = process.env[selectorName]

if (selection === undefined) {
  const { runCli } = await import('@lyness/lyn/lib/bin.js')
  await runCli()
} else {
  Reflect.deleteProperty(process.env, selectorName)
  const { runSelectedSubprocessRunner } = await import('@lyness/lyn-subprocess-local/runner')
  await runSelectedSubprocessRunner(selection)
}
