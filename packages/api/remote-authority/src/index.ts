/**
 * The rule that decides whether one Remote call may be served.
 *
 * It is a plugin rather than part of the Gateway because whether a deployment
 * authorizes at all is a composition choice: an installation with one person
 * at the keyboard has no standings to compare, and refusing them their own
 * machine would be the wrong answer. A deployment that serves named people
 * selects this row, and from then on every wire call is classified or refused
 * ([decision](../../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md)).
 *
 * It refuses on the Gateway's own extension point, which is the one place
 * every wire call passes through. A check inside each controller would be
 * nineteen checks in one namespace and a forgotten one in the next; a check
 * here cannot be reached around, and the gate that holds every namespace to a
 * declaration makes forgetting one a build failure rather than a hole.
 *
 * @module @lyness/lyn-api-remote-authority
 */

import type { Context } from '@lyness/cordis'
import type { RemoteAuthorizationRequest } from '@lyness/lyn-api-gateway'
import type { RemoteAuthority } from '@lyness/lyn-typert-protocol'
import type { Membership, Role } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-request-principal'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'remote-authority'

/** Services this rule reads a caller's standing from. */
export const inject = ['requestPrincipal', 'people']

/** Refusal for a call that presented no identity. */
export const ANONYMOUS = 'this call presented no identity'

/** Refusal for an endpoint neither it nor its namespace classified. */
export const UNCLASSIFIED = 'this endpoint declares no required standing'

/** Refusal for a call acting in a personal context where a standing is required. */
export const NO_STANDING = 'this call acts in no standing'

/**
 * What each role satisfies.
 *
 * A platform administrator satisfies every requirement; a tenant
 * administrator satisfies its own and a member's; a member satisfies only a
 * member's. `anyone` is answered before a role is resolved, so it is absent
 * here rather than listed under each.
 */
const SATISFIES: Readonly<Record<Role, readonly RemoteAuthority[]>> = {
  'platform-administrator': ['member', 'tenant-administrator', 'platform-administrator'],
  'tenant-administrator': ['member', 'tenant-administrator'],
  member: ['member'],
}

/**
 * Whether one standing satisfies one requirement.
 * @param held - the standing the call acts in.
 * @param required - what the endpoint requires.
 * @returns true when the call may be served.
 */
export function satisfies(held: Role, required: RemoteAuthority): boolean {
  return required === 'anyone' || SATISFIES[held].includes(required)
}

/**
 * Register the rule.
 * @param ctx - Host context with the request principal and the directory mounted.
 */
export function apply(ctx: Context): void {
  ctx.on('typert/authorize', async (call: RemoteAuthorizationRequest) => {
    // Answered before any identity is resolved: a sign-in route is reached by
    // somebody who is, by definition, not signed in yet.
    if (call.requires === 'anyone') return undefined
    // Fail closed. An endpoint nobody classified is one nobody decided to
    // expose, and admitting it would make every new method public by default.
    if (call.requires === undefined) return UNCLASSIFIED
    const principal = ctx.requestPrincipal.current()
    if (principal === undefined) return ANONYMOUS
    if (call.requires === 'member') return undefined
    const held = await standingOf(ctx, principal.acting.membership)
    if (held === undefined) return NO_STANDING
    return satisfies(held.role, call.requires) ? undefined : refusal(call.requires, held.role)
  })
}

/** The standing one acting context names, when it names one the directory knows. */
async function standingOf(ctx: Context, membership: Membership['id'] | undefined): Promise<Membership | undefined> {
  if (membership === undefined) return undefined
  return ctx.people.membership(membership)
}

/**
 * The refusal text a caller sees.
 * @param required - what the endpoint requires.
 * @param held - what the call acts in.
 * @returns the reason, naming both so a reader can tell which standing is missing.
 */
export function refusal(required: RemoteAuthority, held: Role): string {
  return `this endpoint requires ${required}; this call acts as ${held}`
}
