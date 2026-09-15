/**
 * The brand-studio profile's command line: parse the operator's invocation,
 * run the studio once, report what it wrote, and request exit.
 * @module @lyness/lyn-brand-studio
 */

import { resolve } from 'node:path'
import { Command } from 'commander'
import type { Context } from '@lyness/cordis'
import { internals, parseCmdline } from '@lyness/lyn-cmdline'
import { lynHomePath, resolveLynHome } from '@lyness/lyn-home-paths'
import { resolveProfilePatch, runStudio } from './studio.ts'
import type { StudioRequest, StudioResult } from './studio.ts'

export { ASSET_FILES, BRAND_PACKAGE, BRAND_ROW_ID, resolveProfilePatch, runStudio, StudioError, upsertBrandRow } from './studio.ts'
export type { StudioRequest, StudioResult } from './studio.ts'

/** Stable Cordis plugin name. */
export const name = 'brand-studio'

/** Launcher service required before the command line can be parsed. */
export const inject = ['cmdlineArgs']

/** Parsed flags; commander fills the defaults. */
interface StudioOptions {
  name: string
  icon: string
  font: string
  themeColor?: string
  assetDir: string
  target: string
  acceptTrademark?: true
}

/**
 * Build this app's command and help.
 * @returns a fresh program for one invocation.
 */
function studioCommand(): Command {
  return new Command()
    .name('lyn --profile brand-studio')
    .description('Generate a deployment brand from an icon PNG and a font, and apply it to a profile.')
    .requiredOption('--name <text>', 'product name, typeset as the wordmark')
    .requiredOption('--icon <png>', 'icon PNG: at least 1024px a side, a dark mark on a light or transparent background')
    .requiredOption('--font <file>', 'TTF, OTF, WOFF, or WOFF2 font that covers every character of the name')
    .option('--theme-color <color>', 'brand colour as a hex colour or a colour keyword')
    .option('--asset-dir <dir>', 'directory receiving the generated SVGs', lynHomePath('brand'))
    .option('--target <profile>', 'profile whose patch layer receives the brand', 'web')
    .option('--accept-trademark', 'confirm that the name and the icon infringe no trademark')
    .helpOption('-h, --help', 'show this help')
    .addHelpText('after', `
Example:
  lyn --profile brand-studio --name Acme --icon ./acme.png --font ./Inter-SemiBold.ttf \\
    --theme-color '#1a73e8' --accept-trademark
`)
}

/**
 * Describe a finished run for the operator.
 * @param request - the run's inputs.
 * @param result - what the run wrote.
 * @param target - profile that received the brand.
 * @returns the report text.
 */
function report(request: StudioRequest, result: StudioResult, target: string): string {
  return [
    `brand-studio: wrote the brand for ${JSON.stringify(request.productName)}`,
    `  mark      ${result.assets.mark} (${result.iconAspect.toFixed(2)}:1)`,
    `  wordmark  ${result.assets.wordmark} (${result.wordmarkAspect.toFixed(2)}:1)`,
    `  favicon   ${result.assets.favicon}`,
    `  patch     ${request.patchPath}`,
    `A running \`lyn --profile ${target}\` that reloads its patch layer applies the brand now; otherwise restart it.`,
    '',
  ].join('\n')
}

/**
 * Run the studio for one accepted invocation.
 * @param options - the parsed flags.
 * @returns the process exit code.
 */
async function run(options: StudioOptions): Promise<number> {
  try {
    const request: StudioRequest = {
      productName: options.name,
      iconPath: resolve(options.icon),
      fontPath: resolve(options.font),
      themeColor: options.themeColor,
      assetDirectory: resolve(options.assetDir),
      patchPath: resolveProfilePatch(options.target, resolveLynHome()),
    }
    internals.stdout.write(report(request, await runStudio(request), options.target))
    return 0
  } catch (error) {
    internals.stderr.write(`brand-studio: ${String(error)}\n`)
    return 1
  }
}

/**
 * Accept a brand-studio invocation, run it, and request exit with its outcome.
 * @param ctx - plugin context carrying the command line and the exit request.
 * @throws when the launcher did not provide the exit request.
 */
export function apply(ctx: Context): void {
  // Read through the global service store, not the property proxy: appExit is
  // an optional host value, never an injected dependency.
  const exit = ctx.get('appExit')
  if (exit === undefined) throw new Error('brand-studio: the launcher must provide ctx.appExit before the tree mounts')
  const program = studioCommand()
  program.action((options: StudioOptions) => {
    if (options.acceptTrademark !== true) {
      program.error('brand-studio: pass --accept-trademark to confirm that the name and the icon infringe no trademark')
    }
    void run(options).then(exit)
  })
  parseCmdline(ctx, program)
}
