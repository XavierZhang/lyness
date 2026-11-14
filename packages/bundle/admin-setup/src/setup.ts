/**
 * The admin-setup run: write a deployment's first platform administrator, the
 * provider they sign in through, and the one admission binding that lets them
 * in, into one profile's patch layer.
 *
 * Every write lands in that layer and nowhere else, because the layer is read
 * again at every boot: what it names cannot be changed from the
 * administration console, which is what makes this administrator the one
 * nobody can lock out of their own deployment.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument, YAMLMap, YAMLSeq } from 'yaml'
import type { Document } from 'yaml'
import { initProfile, PROFILE_PATCH_FILENAME, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'
import { PROFILE_TEMPLATES } from '@deepseek-ai/dsh-official-bundles'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import { CHANNEL_ID } from '@deepseek-ai/dsh-oidc'

/** Loader id of the roster row the accounts module mounts. */
export const PEOPLE_ROW_ID = 'people'

/** Loader id of the admission row the accounts module mounts. */
export const ADMISSION_ROW_ID = 'sign-in-admission'

/** Loader id of the browser sign-in routes the accounts module mounts. */
export const ROUTES_ROW_ID = 'sign-in-http'

/** Loader id this command gives the provider row it inserts. */
export const CHANNEL_ROW_ID = 'sign-in-channel-oidc'

/** Package the provider row loads. */
export const CHANNEL_PACKAGE = '@deepseek-ai/dsh-oidc'

/** The standing the first administrator holds; the only one that administers a whole deployment. */
export const PLATFORM_ROLE = 'platform-administrator'

/** Person ids a roster entry may carry: what a session, a grant and a binding are written against. */
const PERSON_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/u

/** One line of at most 64 characters, so a name cannot carry layout into a surface. */
const DISPLAY_NAME_PATTERN = /^[^\r\n]{1,64}$/u

/** The stable identity a provider reports for one person. */
const SUBJECT_PATTERN = /^[\x21-\x7e]{1,256}$/u

/** Scheme, host and port, with no path: what the routes accept as an origin. */
const ORIGIN_PATTERN = /^https?:\/\/[^\s/]+$/u

/** One admin-setup run. */
export interface AdministratorRequest {
  /** The roster id the administrator is written under; permanent. */
  readonly person: string
  /** The name a surface shows them by. */
  readonly displayName: string
  /** The provider's issuer identifier, which is also where discovery is read from. */
  readonly issuer: string
  /** The client this deployment is registered as with the provider. */
  readonly clientId: string
  /** Their stable identity within that provider: the `sub` claim, never an address. */
  readonly subject: string
  /** Credential reference the provider's client secret is read under. */
  readonly secretName: string
  /**
   * The origin a browser reaches this deployment at, with no trailing slash.
   *
   * The routes cannot infer it — behind a proxy the request's own `Host` is
   * the proxy's — and the provider must be registered with a redirect URI
   * under exactly this origin.
   */
  readonly publicOrigin: string
  /** Whether an administrator the layer already names may be replaced. */
  readonly replace: boolean
  /** The patch layer receiving all of it. */
  readonly patchPath: string
}

/** A run refused because of what the operator supplied; the message is written for the operator. */
export class SetupError extends Error {
  override name = 'SetupError'
}

/**
 * Locate a profile's patch layer, initializing a shipped profile that has
 * never launched exactly as its first launch would.
 * @param profile - profile name.
 * @param home - dsh home directory.
 * @returns the absolute patch-layer path.
 * @throws {SetupError} when the profile neither exists nor is shipped.
 */
export function resolveProfilePatch(profile: string, home: string): string {
  const dir = resolveProfileDir(profile, home)
  if (!existsSync(join(dir, 'package.json'))) {
    const template = PROFILE_TEMPLATES[profile]
    if (template === undefined) {
      throw new SetupError(`profile ${JSON.stringify(profile)} does not exist; create it first, or name a shipped profile`)
    }
    initProfile(dir, template.bundles)
  }
  return join(dir, PROFILE_PATCH_FILENAME)
}

/**
 * The rows of a patch layer, as a sequence this run may add to.
 * @param document - the parsed layer.
 * @returns its top-level sequence.
 * @throws {SetupError} when the layer is not a YAML array.
 */
function rowsOf(document: Document): YAMLSeq {
  const rows = document.contents ?? new YAMLSeq()
  if (!isSeq(rows)) throw new SetupError('the patch layer must be a top-level YAML array of rows')
  document.contents = rows
  rows.flow = false
  return rows
}

/**
 * One id-targeted patch row, added when the layer has none.
 *
 * No `name` is written: a patch naming a package the composed row does not
 * load is skipped, and which package answers an id is the module's to change.
 * @param rows - the layer's rows.
 * @param id - the row id to target.
 * @returns that row's `config` map.
 */
function configOf(rows: YAMLSeq, id: string): YAMLMap {
  const found = rows.items.find((row): row is YAMLMap => isMap(row) && row.get('id') === id)
  const row = found ?? new YAMLMap()
  if (found === undefined) {
    row.set('id', id)
    rows.items.push(row)
  }
  const existing = row.get('config', true)
  const config = isMap(existing) ? existing : new YAMLMap()
  row.set('config', config)
  return config
}

/**
 * The provider row this run inserts, added when the layer has none.
 *
 * An insert rather than an id patch: the accounts module composes no provider,
 * so a patch targeting this id would name a row that does not exist and be
 * skipped with a warning nobody reads.
 * @param rows - the layer's rows.
 * @returns the inserted row's `config` map.
 */
function channelConfig(rows: YAMLSeq): YAMLMap {
  for (const entry of rows.items) {
    if (!isMap(entry)) continue
    const inserted = entry.get('insert', true)
    if (!isSeq(inserted)) continue
    const found = inserted.items.find((row): row is YAMLMap => isMap(row) && row.get('id') === CHANNEL_ROW_ID)
    if (found === undefined) continue
    const existing = found.get('config', true)
    const config = isMap(existing) ? existing : new YAMLMap()
    found.set('name', CHANNEL_PACKAGE)
    found.set('config', config)
    return config
  }
  const row = new YAMLMap()
  row.set('id', CHANNEL_ROW_ID)
  row.set('name', CHANNEL_PACKAGE)
  const config = new YAMLMap()
  row.set('config', config)
  const list = new YAMLSeq()
  list.items.push(row)
  const entry = new YAMLMap()
  entry.set('insert', list)
  rows.items.push(entry)
  return config
}

/**
 * The entries of one config key, as a sequence this run may add to.
 * @param config - the row's config map.
 * @param key - the key holding the list.
 * @returns that list.
 */
function listOf(config: YAMLMap, key: string): YAMLSeq {
  const existing = config.get(key, true)
  const list = isSeq(existing) ? existing : new YAMLSeq()
  list.flow = false
  config.set(key, list)
  return list
}

/**
 * Refuse a run whose inputs a deployment could not use.
 * @param request - the run's inputs.
 * @throws {SetupError} naming the one field to correct.
 */
function validate(request: AdministratorRequest): void {
  if (!PERSON_ID_PATTERN.test(request.person)) {
    throw new SetupError(`the person id must be letters, digits, dot, dash or underscore; got ${JSON.stringify(request.person)}`)
  }
  if (!DISPLAY_NAME_PATTERN.test(request.displayName)) {
    throw new SetupError(`the name must be one line of at most 64 characters; got ${JSON.stringify(request.displayName)}`)
  }
  if (!SUBJECT_PATTERN.test(request.subject)) {
    throw new SetupError(`the subject must be the provider's own identity for this person; got ${JSON.stringify(request.subject)}`)
  }
  if (!isCredentialRefName(request.secretName)) {
    throw new SetupError(`${JSON.stringify(request.secretName)} is not a credential reference name`)
  }
  for (const [field, value] of [['issuer', request.issuer], ['public origin', request.publicOrigin]] as const) {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new SetupError(`the ${field} must be a URL; got ${JSON.stringify(value)}`)
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new SetupError(`the ${field} must be an http or https URL; got ${JSON.stringify(value)}`)
    }
  }
  if (!ORIGIN_PATTERN.test(request.publicOrigin)) {
    throw new SetupError(`the public origin carries a path; it is scheme, host and port only, such as "https://acme.example"; got ${JSON.stringify(request.publicOrigin)}`)
  }
}

/**
 * Whether the browser reaches this deployment over TLS.
 *
 * Derived from the origin the operator gave rather than asked for twice: the
 * cookies' `Secure` follows the scheme a browser actually uses, and the two
 * cannot disagree without breaking every sign-in.
 * @param publicOrigin - the origin a browser reaches this deployment at.
 * @returns whether the session cookies carry `Secure`.
 */
export function secureCookies(publicOrigin: string): boolean {
  return publicOrigin.startsWith('https://')
}

/**
 * The redirect URI the provider must be registered with for this deployment.
 * @param publicOrigin - the origin a browser reaches this deployment at.
 * @returns the address the provider returns the browser to.
 */
export function redirectUri(publicOrigin: string): string {
  return `${publicOrigin}/auth/callback/${CHANNEL_ID}`
}

/**
 * Whether one roster entry is a written platform administrator.
 * @param entry - one entry of the roster list.
 * @returns true when it administers the whole deployment.
 */
function administers(entry: unknown): entry is YAMLMap {
  return isMap(entry) && entry.get('role') === PLATFORM_ROLE
}

/**
 * Write the first administrator, their provider and their binding into one
 * patch layer.
 *
 * Comments, other rows, other people, other bindings and `!!js` values stay as
 * written: this sets the three things it owns and nothing else.
 * @param layer - current patch-layer text; empty when the file does not exist.
 * @param request - the run's inputs.
 * @returns the new patch-layer text.
 * @throws {SetupError} for an unusable input, or an administrator already written.
 */
export function upsertFirstAdministrator(layer: string, request: AdministratorRequest): string {
  validate(request)
  const document: Document = parseDocument(layer)
  const [error] = document.errors
  if (error !== undefined) throw new SetupError(`the patch layer is not valid YAML: ${error.message}`)
  const rows = rowsOf(document)

  const people = listOf(configOf(rows, PEOPLE_ROW_ID), 'people')
  const held = people.items.filter(administers)
  const other = held.find(entry => entry.get('id') !== request.person)
  if (other !== undefined && !request.replace) {
    throw new SetupError([
      `this deployment already has a written administrator: ${JSON.stringify(String(other.get('id')))}.`,
      'Nothing was changed. Pass --replace to write another one in their place,',
      'or add further administrators from the administration console.',
    ].join(' '))
  }
  for (const entry of held) {
    if (entry.get('id') !== request.person) people.items.splice(people.items.indexOf(entry), 1)
  }
  const existing = people.items.find((entry): entry is YAMLMap => isMap(entry) && entry.get('id') === request.person)
  const person = existing ?? new YAMLMap()
  if (existing === undefined) people.items.push(person)
  person.set('id', request.person)
  person.set('displayName', request.displayName)
  person.set('role', PLATFORM_ROLE)

  const channel = channelConfig(rows)
  channel.set('issuer', request.issuer)
  channel.set('clientId', request.clientId)
  channel.set('secret', request.secretName)

  const routes = configOf(rows, ROUTES_ROW_ID)
  routes.set('publicOrigin', request.publicOrigin)
  routes.set('secureCookies', secureCookies(request.publicOrigin))

  const bindings = listOf(configOf(rows, ADMISSION_ROW_ID), 'bindings')
  const bound = bindings.items.find((entry): entry is YAMLMap =>
    isMap(entry) && entry.get('channel') === CHANNEL_ID && entry.get('person') === request.person)
  const binding = bound ?? new YAMLMap()
  if (bound === undefined) bindings.items.push(binding)
  binding.set('channel', CHANNEL_ID)
  binding.set('issuer', request.issuer)
  binding.set('subject', request.subject)
  binding.set('person', request.person)

  return document.toString()
}

/**
 * Run the setup once: compose the new layer, then replace the file atomically.
 * @param request - the run's inputs.
 * @throws {SetupError} for an unusable input, or an administrator already written.
 */
export async function runSetup(request: AdministratorRequest): Promise<void> {
  const current = await readFile(request.patchPath, 'utf8').catch((error: unknown) => {
    // A layer the profile has not written yet is created by this run; any
    // other failure is the operator's to see.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  })
  await writeFileAtomic(request.patchPath, upsertFirstAdministrator(current, request), { mode: 0o644 })
}
