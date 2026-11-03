/** Test-owned Remote face: `$on` subscriptions with an explicit test event driver. */
import type { Context } from '@lyness/cordis'

// Value re-export for spec-side failure construction: the api-remotes facade
// cannot carry it — its src top-level imports owner /remote lib artifacts, so a
// value import from a spec would load the unbuilt assembly chain.
export { RemoteError } from '@lyness/lyn-typert-protocol'

/**
 * Remote service test double for the forwarded-event path. Feature specs need
 * `ctx.remote.$on` to exist (their plugins inject `remote`) and need forwarded
 * Host events to reach those subscribers, but not the wire — so this double
 * implements subscription plus an explicit `emit` driver available only on the
 * concrete test object. A spec that also calls one namespace scripts it through
 * the constructor rather than reaching the real Client Remote service.
 *
 * `$mount` rejects: a spec that needs a real generated contribution installed —
 * codecs, descriptors, and the wire — has outgrown this double and needs the
 * real Client Remote service.
 *
 * One deliberate asymmetry with production: a throwing listener propagates out
 * of the emit instead of being contained and logged, so a spec cannot lean on
 * this double for the containment guarantee `$on` documents — assert that
 * against the real service.
 */
export class TestRemote {
  private readonly subscriptions = new Map<string, Set<(...args: never[]) => void>>()

  /**
   * Fixed Host facts mirrored from the production `ctx.remote.$host`. Plain
   * mutable field: a spec assigns it to script a non-loopback or homed Host.
   */
  $host: { home: string | undefined; isLoopback: boolean } = { home: undefined, isLoopback: true }

  private readonly contributions = new Map<symbol, unknown>()

  /**
   * Register the double as `ctx.remote`, plus one service per scripted
   * namespace so a plugin injecting `remote.<name>` also unparks.
   * @param ctx - the spec's root Context.
   * @param namespaces - scripted namespace faces reached as `ctx.remote.<name>`.
   */
  constructor(private readonly ctx: Context, namespaces: Readonly<Record<string, object>> = {}) {
    this.validateNamespaces(namespaces)
    ctx.provide('remote', this)
    this.installNamespaces(namespaces)
  }

  /**
   * Add scripted namespace faces to this Remote service.
   * @param namespaces - scripted namespace faces reached as `ctx.remote.<name>`.
   */
  provideNamespaces(namespaces: Readonly<Record<string, object>>): void {
    this.validateNamespaces(namespaces)
    this.installNamespaces(namespaces)
  }

  private validateNamespaces(namespaces: Readonly<Record<string, object>>): void {
    for (const name of Object.keys(namespaces)) {
      // A namespace named after one of the double's own members would replace
      // it, and a spec relies on every one of those members.
      if (name in this) {
        throw new TypeError(`TestRemote: scripted namespace "${name}" would shadow the double's own member`)
      }
    }
  }

  private installNamespaces(namespaces: Readonly<Record<string, object>>): void {
    Object.assign(this, namespaces)
    for (const [name, face] of Object.entries(namespaces)) this.ctx.provide(`remote.${name}`, face)
  }

  /**
   * Deliver one forwarded host event to its subscribers, standing in for the
   * carrier that owns the frame sink.
   * @param event - forwarded host event name.
   * @param args - the Host argument list, verbatim.
   */
  emit(event: string, args: readonly unknown[]): void {
    const listeners = this.subscriptions.get(event)
    if (listeners === undefined) return
    for (const listener of [...listeners]) listener(...args as never[])
  }

  /**
   * Subscribe to one forwarded host event.
   * @param event - forwarded host event name.
   * @param listener - receives the Host argument list verbatim.
   * @returns disposer removing this subscription.
   */
  $on(event: string, listener: (...args: never[]) => void): () => void {
    const listeners = this.subscriptions.get(event) ?? new Set()
    this.subscriptions.set(event, listeners)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  /**
   * Accept one generated Remote contribution.
   *
   * Nothing is installed from it: this double's namespaces are scripted by
   * its constructor, so a mount is only the record that a plugin asked for
   * one. A spec reads {@link mounted} to assert that a page mounts the
   * namespace it calls instead of relying on somebody else to.
   * @param contribution - the generated contribution, kept verbatim.
   * @returns the disposer, which withdraws that record.
   */
  $mount(contribution: unknown): Promise<() => Promise<void>> {
    const token = Symbol('TestRemote.$mount')
    this.contributions.set(token, contribution)
    return Promise.resolve(() => {
      this.contributions.delete(token)
      return Promise.resolve()
    })
  }

  /** Generated Remote contributions mounted on this double, in mount order. */
  get mounted(): readonly unknown[] {
    return [...this.contributions.values()]
  }
}
