/**
 * The brand-setup invocation: the command this app answers to, its `--help`
 * text, and the loopback bind it publishes.
 *
 * It exists so that `--help` costs nothing. The server row injects what this
 * provider publishes, so an invocation that only asks for help — or names a
 * bad flag — never reaches a bind: commander writes its text, the launcher
 * exits, and the loopback port is never opened.
 *
 * @module @lyness/lyn-brand-setup/startup
 */

import { Command } from 'commander'
import { Context } from '@lyness/cordis'
import { parseCmdline } from '@lyness/lyn-cmdline'
import type {} from '@lyness/lyn-cmdline'

/** Service provided by this ordinary plugin and injected by the server row. */
export const BRAND_SETUP_STARTUP_SERVICE = 'brandSetupStartup'

declare module '@lyness/cordis' {
  interface Context {
    /** Where the brand-setup page binds, provided only on a successful parse. */
    brandSetupStartup: BrandSetupStartup
  }
}

/** The loopback bind this invocation asked for. */
export interface BrandSetupStartup {
  /** Loopback interface to bind; never a wildcard, because the page writes a profile. */
  readonly host: string
  /** Port to bind, or 0 for an OS-assigned one. */
  readonly port: number
}

/** Flags this invocation may name. */
interface SetupOptions {
  readonly port?: string
}

export const name = 'brand-setup-startup'
export const inject = ['cmdlineArgs']

/**
 * This app's command: its one flag, its description, and its help text.
 * @returns a fresh program for one invocation.
 */
function setupCommand(): Command {
  return new Command()
    .name('brand-setup')
    .description('brand a deployment from a loopback page, reachable only through the token this command prints')
    .option('--port <port>', 'loopback port to bind; omitted takes an OS-assigned one')
    .helpOption('-h, --help', 'show this help')
    .addHelpText('after', `
Examples:
  lyn --profile brand-setup
  lyn --profile brand-setup --port 7345

The page binds 127.0.0.1 only and ends with this process. It is reachable
solely through the one-time token printed on start, so nothing on the network
can reach it and no second visitor can.
`)
}

/**
 * Parse and publish the brand-setup invocation as an ordinary Cordis service.
 * `--help` and a rejected flag publish nothing, so no server binds.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const program = setupCommand()
  program.action(() => {
    const options = program.opts<SetupOptions>()
    if (options.port !== undefined && !/^\d+$/.test(options.port)) {
      program.error(`error: --port must be a number, got ${JSON.stringify(options.port)}`)
    }
    const port = options.port === undefined ? 0 : Number(options.port)
    if (port > 65535) program.error(`error: --port ${String(port)} is not a port number`)
    ctx.provide(BRAND_SETUP_STARTUP_SERVICE, { host: '127.0.0.1', port })
  })
  parseCmdline(ctx, program)
}
