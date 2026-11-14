/**
 * The admin-setup profile's command line: write a deployment's first platform
 * administrator into a profile's patch layer, report what it wrote, and
 * request exit.
 *
 * One command, run once, on the machine the deployment runs on: the layer it
 * writes outranks every runtime surface, so standing where the files are is
 * what authorizes the write.
 * @module @deepseek-ai/dsh-admin-setup
 */

import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { internals, parseCmdline } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { CHANNEL_ID } from '@deepseek-ai/dsh-oidc'
import { redirectUri, resolveProfilePatch, runSetup, secureCookies } from './setup.ts'
import type { AdministratorRequest } from './setup.ts'

export {
  ADMISSION_ROW_ID, CHANNEL_PACKAGE, CHANNEL_ROW_ID, PEOPLE_ROW_ID, PLATFORM_ROLE,
  redirectUri, resolveProfilePatch, ROUTES_ROW_ID, runSetup, secureCookies, SetupError,
  upsertFirstAdministrator,
} from './setup.ts'
export type { AdministratorRequest } from './setup.ts'

/** Stable Cordis plugin name. */
export const name = 'admin-setup'

/** Launcher service required before the command line can be parsed. */
export const inject = ['cmdlineArgs']

/** Credential reference the provider's client secret is read under, unless the operator names another. */
export const DEFAULT_SECRET_NAME = 'OIDC_CLIENT_SECRET'

/** Parsed flags; commander fills the defaults. */
interface SetupOptions {
  target: string
  person: string
  name: string
  issuer: string
  clientId: string
  subject: string
  secretName: string
  publicOrigin: string
  replace?: true
}

/**
 * Build this app's command and help.
 * @returns a fresh program for one invocation.
 */
function setupCommand(): Command {
  return new Command()
    .name('dsh --profile admin-setup')
    .description([
      "Write a deployment's first platform administrator into a profile's patch layer,",
      'with the OpenID provider they sign in through and the one binding that admits them.',
      'Run it once, where the deployment runs, before its first start.',
    ].join('\n'))
    .requiredOption('--target <profile>', 'profile this administrator is written into')
    .requiredOption('--person <id>', 'roster id, permanent: sessions, grants and bindings are written against it')
    .requiredOption('--name <text>', 'name a surface shows them by')
    .requiredOption('--issuer <url>', "the provider's issuer URL, which is also where discovery is read from")
    .requiredOption('--client-id <id>', 'the client this deployment is registered as with the provider')
    .requiredOption('--subject <sub>', "the provider's own stable identity for this person: its `sub` claim")
    .requiredOption('--public-origin <url>', 'the origin a browser reaches this deployment at: scheme, host and port')
    .option('--secret-name <ref>', "credential reference the provider's client secret is read under", DEFAULT_SECRET_NAME)
    .option('--replace', 'write this administrator in place of one the layer already names')
    .helpOption('-h, --help', 'show this help')
    .addHelpText('after', `
Where the subject comes from: open the provider's own console, find the person,
and copy the id it keeps them under. It is never their address — an address can
be reassigned, and this binding must not follow it.

Examples:
  dsh --profile admin-setup --target acme --person ada --name Ada \\
    --issuer https://id.acme.example --client-id 2984... --subject 2984... \\
    --public-origin https://agent.acme.example
  dsh --profile admin-setup --target acme --person ada --name Ada \\
    --issuer https://id.acme.example --client-id 2984... --subject 3071... \\
    --public-origin https://agent.acme.example --replace
`)
}

/**
 * Describe a finished run for the operator.
 * @param request - the run's inputs.
 * @param target - profile that received the administrator.
 * @returns the report text.
 */
function report(request: AdministratorRequest, target: string): string {
  return [
    `admin-setup: ${JSON.stringify(request.displayName)} administers the ${JSON.stringify(target)} deployment`,
    `  person    ${request.person}`,
    `  provider  ${request.issuer} (channel ${CHANNEL_ID}, client ${request.clientId})`,
    `  subject   ${request.subject}`,
    `  browser   ${request.publicOrigin} (cookies ${secureCookies(request.publicOrigin) ? 'secure' : 'not secure, which is plain HTTP'})`,
    `  patch     ${request.patchPath}`,
    '',
    'Two things left, in this order:',
    `  1. register this redirect URI with the provider: ${redirectUri(request.publicOrigin)}`,
    `  2. start it with the client secret: ${request.secretName}=… dsh --profile ${target}`,
    '',
    'Then start it and sign in. This administrator is written into the layer the',
    'deployment reads at every boot, so the console cannot change or remove them —',
    'which is also the way back in if anybody else is locked out.',
    '',
  ].join('\n')
}

/**
 * Run the setup for one accepted invocation.
 * @param options - the parsed flags.
 * @returns the process exit code.
 */
async function run(options: SetupOptions): Promise<number> {
  try {
    const request: AdministratorRequest = {
      person: options.person,
      displayName: options.name,
      issuer: options.issuer,
      clientId: options.clientId,
      subject: options.subject,
      secretName: options.secretName,
      publicOrigin: options.publicOrigin,
      replace: options.replace === true,
      patchPath: resolveProfilePatch(options.target, resolveDshHome()),
    }
    await runSetup(request)
    internals.stdout.write(report(request, options.target))
    return 0
  } catch (error) {
    internals.stderr.write(`admin-setup: ${String(error)}\n`)
    return 1
  }
}

/**
 * Accept an admin-setup invocation, run it, and request exit with its outcome.
 * @param ctx - plugin context carrying the command line and the exit request.
 * @throws {Error} when the launcher did not provide the exit request.
 */
export function apply(ctx: Context): void {
  // Read through the global service store, not the property proxy: appExit is
  // an optional host value, never an injected dependency.
  const exit = ctx.get('appExit')
  if (exit === undefined) throw new Error('admin-setup: the launcher must provide ctx.appExit before the tree mounts')
  const program = setupCommand()
  program.action((options: SetupOptions) => { void run(options).then(exit) })
  parseCmdline(ctx, program)
}
