/**
 * Remote decorators and explicit Gateway bindings backed by versioned
 * descriptors carried on decorated class prototypes. Strict reflection
 * remains a Typert compiler responsibility.
 * @module @lyness/lyn-typert-protocol
 */

import { Context, Service } from '@lyness/cordis'
import type { TypertContextMap } from './types.ts'

export { RemoteError, remoteErrorOf } from './remote-error.ts'
export { TYPERT_OWNED_VALUE, isTypertOwnedValue, typertOwnedValue } from './owned-value.ts'
export type { TypertOwnedValue } from './owned-value.ts'
export { isRemoteJsonValue, isRemoteUplinkItem } from './json-value.ts'

const TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/

/**
 * Test one generated Remote name against the Connection endpoint grammar.
 * @param value - namespace, method, lookup, or Context segment.
 * @returns whether the value can cross the shared RPC carrier unchanged.
 */
export function isTypertRemoteSegment(value: string): boolean {
  return value !== '.' && value !== '..' && TYPERT_REMOTE_SEGMENT_PATTERN.test(value)
}

export type {
  InvocationDescriptor,
  InvocationParameterDescriptor,
  InvocationSourceLocation,
  PeerId,
  PeerScope,
  RemoteErrorCode,
  RemoteErrorDetailsMap,
  RemoteFailure,
  RemoteInvocation,
  RemoteResult,
  RemoteStream,
  RemoteStreamHandle,
  TypertClientEventListener,
  TypertClientRemote,
  TypertClientContextAdapter,
  TypertCodec,
  TypertContext,
  TypertContextMap,
  TypertContextRegistry,
  TypertContextWire,
  TypertDisposer,
  TypertForwardableEvent,
  TypertForwardableEventEntry,
  TypertHostContextAdapter,
  TypertHostContextResolver,
  TypertLocalRegistry,
  TypertLookup,
  TypertLookupDefinition,
  TypertLookupHost,
  TypertLookupMap,
  TypertLookupProvider,
  TypertLookupResolver,
  TypertLookupRegistry,
  TypertLookupWire,
  TypertRemoteScopeApi,
  TypertRemoteScopeMap,
  TypertRemoteScopeNamespace,
  TypertRemoteContribution,
  TypertRemoteEvent,
  TypertRemoteEventSelection,
  TypertRemoteMap,
  TypertRemoteNamespace,
  TypertRemoteNamespaceMap,
  TypertRemoteRegistry,
  TypertRegistryChange,
  TypertRegistryListener,
  TypertSchema,
  TypertRegistryContract,
} from './types.ts'

/**
 * The standing one Remote call must hold to be served.
 *
 * Declared rather than inferred, because a namespace nobody classified is a
 * namespace everybody reaches. `anyone` admits a call that presented no
 * identity at all — a sign-in page, or what a deployment has announced.
 * `member` admits any signed-in person. The two administrator values admit
 * that standing and the platform's; a tenant administrator is not admitted
 * where the platform's is required.
 *
 * Whether any of this is enforced is a composition choice: a deployment with
 * no accounts has one operator, and refusing them their own installation
 * would be the wrong answer.
 */
export type RemoteAuthority = 'anyone' | 'member' | 'tenant-administrator' | 'platform-administrator'

/** Options for an explicit Service-to-Gateway binding. */
export interface TypertGatewayBindingOptions {
  /** Wire namespace; defaults to the Cordis service key. */
  readonly namespace?: string
  /**
   * The standing every method in this namespace requires unless it declares
   * its own. Omitting it leaves the namespace unclassified, which an
   * enforcing deployment refuses rather than admits.
   */
  readonly requires?: RemoteAuthority
}

/** Visible declaration that one Service participates in Typert Gateway export. */
export interface TypertGatewayBinding<Service extends object = object> {
  readonly service: Service
  readonly serviceKey: string
  readonly namespace: string
  /** The namespace's declared standing; absent when it declared none. */
  readonly requires?: RemoteAuthority
}

/** Invocation mode recorded by a Remote method decorator. */
export type RemoteInvocationMarker =
  | { readonly kind: 'direct' }
  | { readonly kind: 'context'; readonly context: string }

/** One decorator marker discovered for a live Service instance. */
export interface RemoteMethodMarker {
  /** Public instance method carrying the implementation. */
  readonly method: string
  /** Endpoint method when it differs from the implementation member. */
  readonly exportName?: string
  /** Stream methods yield many independently validated result items. */
  readonly mode?: 'stream'
  /** The standing this method requires, overriding its namespace's. */
  readonly requires?: RemoteAuthority
  readonly invocation: RemoteInvocationMarker
}

/** Options for a Remote method that is not an ordinary unary call at its namespace's standing. */
export interface RemoteMethodOptions {
  /** Endpoint method name, where it differs from the implementation member. */
  readonly exportName?: string
  /** `stream`: deliver each Iterable item over the shared logical-stream carrier. */
  readonly mode?: 'stream'
  /**
   * The standing this one method requires, where it differs from its
   * namespace's. Raising it is the common case: one write, or one operation
   * that reaches the machine, inside a namespace members otherwise read.
   */
  readonly requires?: RemoteAuthority
}

type RemoteMethodDecorator = <This extends object, Args extends unknown[], Result>(
  method: (this: This, ...args: Args) => Result,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
) => void

interface RemoteInitializerContext<This extends object> {
  readonly private: boolean
  readonly static: boolean
  readonly name: string | symbol
  addInitializer(initializer: (this: This) => void): void
}

interface StoredRemoteMethodMarker {
  readonly exportName?: string
  readonly mode?: 'stream'
  readonly requires?: RemoteAuthority
  readonly invocation: RemoteInvocationMarker
}

interface StoredRemoteMethod extends StoredRemoteMethodMarker {
  readonly method: string
}

interface RemoteMethodDescriptorV1 {
  readonly version: 1
  readonly methods: readonly StoredRemoteMethod[]
}

const REMOTE_METHOD_DESCRIPTOR = '@lyness/lyn-typert-protocol/remote-methods'

/**
 * Bind one visible Service field to a Cordis key and Remote namespace. A
 * service that owns a Cordis Context also gives its tree `ctx.invocation`,
 * `undefined` outside a Remote call, so no `TypertRemoteService` is needed for
 * a Host composition to read it.
 * @param service - owning Service instance, normally `this`.
 * @param serviceKey - exact Cordis service key.
 * @param options - optional distinct wire namespace.
 * @returns a frozen, inspectable binding with no compiler-injected metadata.
 */
export function bindTypertRemote<Service extends object>(
  service: Service,
  serviceKey: string,
  options: TypertGatewayBindingOptions = {},
): TypertGatewayBinding<Service> {
  validateName('service key', serviceKey)
  const namespace = options.namespace ?? serviceKey
  validateName('namespace', namespace)
  const ctx: unknown = Reflect.get(service, 'ctx')
  if (ctx instanceof Context) provideInvocationAccessor(ctx)
  return Object.freeze({
    service,
    serviceKey,
    namespace,
    ...options.requires === undefined ? {} : { requires: options.requires },
  })
}

/** Cordis Service base that exposes its registered name through Typert Gateway. */
export abstract class TypertRemoteService<out T = never> extends Service<T> {
  /** Visible binding consumed by the Gateway's source-mode discovery. */
  readonly typertRemote: TypertGatewayBinding<this>

  /**
   * Register the Service and bind the same key to Typert Gateway.
   * @param ctx - owning Cordis Context.
   * @param serviceKey - exact Cordis service key and default wire namespace.
   * @param options - optional distinct wire namespace.
   */
  protected constructor(ctx: Context, serviceKey: string, options: TypertGatewayBindingOptions = {}) {
    super(ctx, serviceKey)
    this.typertRemote = bindTypertRemote(this, this.name, options)
  }
}

/**
 * Make `ctx.invocation` read as `undefined` outside a Remote call instead of the
 * reflect service's "cannot get property" error; a call-derived Context shadows
 * the accessor with its own property. The first Remote Service constructed in a
 * tree registers it on the root, where it outlives any one Service.
 */
function provideInvocationAccessor(ctx: Context): void {
  if (Object.hasOwn(ctx.root.reflect.props, 'invocation')) return
  ctx.root.accessor('invocation', { get: () => undefined })
}

/**
 * Mark one public instance method as a direct Remote invocation.
 * @param _method - decorated method; retained only by the class itself.
 * @param context - standard decorator context used to schedule private marking.
 */
export function Remote<This extends object, Args extends unknown[], Result>(
  _method: (this: This, ...args: Args) => Result,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
): void
/**
 * Mark one public instance method under an exported name or as a logical stream.
 * @param option - endpoint method name or stream delivery mode.
 * @returns a standard method decorator.
 */
export function Remote(option: string | RemoteMethodOptions): RemoteMethodDecorator
export function Remote<This extends object, Args extends unknown[], Result>(
  methodExportOrOptions: string | RemoteMethodOptions | ((this: This, ...args: Args) => Result),
  context?: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
): void | RemoteMethodDecorator {
  if (typeof methodExportOrOptions === 'string') {
    validateName('Remote export name', methodExportOrOptions)
    return remoteDecorator({ kind: 'direct' }, {}, methodExportOrOptions)
  }
  if (typeof methodExportOrOptions === 'object') {
    const options = validateOptions(methodExportOrOptions)
    return remoteDecorator({ kind: 'direct' }, options, options.exportName)
  }
  if (context === undefined) throw new TypeError('typert-protocol: Remote decorator context is missing')
  addMarkerInitializer(context, { kind: 'direct' }, {})
}

const AUTHORITIES: ReadonlySet<string> = new Set<RemoteAuthority>([
  'anyone', 'member', 'tenant-administrator', 'platform-administrator',
])

/**
 * Read one Remote method's options, refusing anything the marker cannot carry.
 *
 * Checked here rather than left to the type system because a decorator's
 * argument is also what a JavaScript consumer writes, and an unrecognized
 * option would record a method as unclassified instead of failing.
 */
function validateOptions(options: object): RemoteMethodOptions {
  const accepted = new Set<string | symbol>(['exportName', 'mode', 'requires'])
  const unknownKeys = Reflect.ownKeys(options).filter(key => !accepted.has(key))
  if (unknownKeys.length > 0) {
    throw new TypeError(`typert-protocol: Remote options do not accept ${String(unknownKeys[0])}`)
  }
  const mode: unknown = Reflect.get(options, 'mode')
  if (mode !== undefined && mode !== 'stream') {
    throw new TypeError('typert-protocol: Remote mode must be "stream" when present')
  }
  const requires: unknown = Reflect.get(options, 'requires')
  if (requires !== undefined && (typeof requires !== 'string' || !AUTHORITIES.has(requires))) {
    throw new TypeError('typert-protocol: Remote requires must name a RemoteAuthority')
  }
  const exportName: unknown = Reflect.get(options, 'exportName')
  if (exportName !== undefined) {
    if (typeof exportName !== 'string') {
      throw new TypeError('typert-protocol: Remote exportName must be a string when present')
    }
    validateName('Remote export name', exportName)
  }
  if (mode === undefined && requires === undefined && exportName === undefined) {
    throw new TypeError('typert-protocol: Remote options must declare exportName, mode, or requires')
  }
  return {
    ...exportName === undefined ? {} : { exportName },
    ...mode === undefined ? {} : { mode: 'stream' as const },
    ...requires === undefined ? {} : { requires: requires as RemoteAuthority },
  }
}

function remoteDecorator(
  invocation: RemoteInvocationMarker,
  options: RemoteMethodOptions,
  exportName?: string,
): RemoteMethodDecorator {
  return function <This extends object, Args extends unknown[], Result>(
    _method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ): void {
    addMarkerInitializer(context, invocation, options, exportName)
  }
}

/**
 * Create a decorator for a method resolved from one Remote Scope.
 * @param key - scope key declared through the Context map.
 * @param exportName - optional Remote export name; defaults to the method name.
 * @returns a standard method decorator that records a versioned prototype descriptor.
 */
export function RemoteScope(
  key: Extract<keyof TypertContextMap, string>,
  exportName?: string,
): RemoteMethodDecorator {
  validateName('Scope key', key)
  if (exportName !== undefined) validateName('Remote export name', exportName)
  return remoteDecorator({ kind: 'context', context: key }, {}, exportName)
}

/**
 * Read Remote markers attached to a live Service's class prototype.
 * The returned snapshot cannot mutate the stored descriptor.
 * @param service - live Service instance.
 * @returns markers in class declaration order.
 */
export function remoteMethods(service: object): readonly RemoteMethodMarker[] {
  const prototype = Object.getPrototypeOf(service) as object | null
  if (prototype === null) return []
  return (readRemoteMethodDescriptor(prototype)?.methods ?? []).map(marker => ({ ...marker }))
}

function readRemoteMethodDescriptor(prototype: object): RemoteMethodDescriptorV1 | undefined {
  const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR)
  if (property === undefined) return undefined
  const descriptor: unknown = property.value
  if (descriptor === null || typeof descriptor !== 'object') {
    throw new TypeError('typert-protocol: Remote method descriptor must be an object')
  }
  const version: unknown = Reflect.get(descriptor, 'version')
  if (version !== 1) {
    throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version)}`)
  }
  const methods: unknown = Reflect.get(descriptor, 'methods')
  if (!Array.isArray(methods)) {
    throw new TypeError('typert-protocol: Remote method descriptor methods must be an array')
  }
  return descriptor as RemoteMethodDescriptorV1
}

function addMarkerInitializer<This extends object>(
  context: RemoteInitializerContext<This>,
  invocation: RemoteInvocationMarker,
  options: RemoteMethodOptions,
  exportName?: string,
): void {
  if (context.private || context.static || typeof context.name !== 'string') {
    throw new TypeError('typert-protocol: Remote decorators require a public instance method with a string name')
  }
  const method = context.name
  context.addInitializer(function (this: This) {
    const prototype = Object.getPrototypeOf(this) as object | null
    if (prototype === null) {
      throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`)
    }
    mark(prototype, method, invocation, options, exportName)
  })
}

function mark(
  prototype: object,
  method: string,
  invocation: RemoteInvocationMarker,
  options: RemoteMethodOptions,
  exportName?: string,
): void {
  const descriptor = readRemoteMethodDescriptor(prototype)
  const marker: StoredRemoteMethod = Object.freeze({
    method,
    ...(exportName === undefined || exportName === method ? {} : { exportName }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.requires === undefined ? {} : { requires: options.requires }),
    invocation: Object.freeze(invocation),
  })
  const current = descriptor?.methods.find(candidate => candidate.method === method)
  if (current !== undefined) {
    if (current.exportName === marker.exportName
      && current.mode === marker.mode
      && current.requires === marker.requires
      && sameInvocation(current.invocation, invocation)) return
    throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`)
  }
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze([...(descriptor?.methods ?? []), marker]),
    } satisfies RemoteMethodDescriptorV1),
  })
}

function sameInvocation(left: RemoteInvocationMarker, right: RemoteInvocationMarker): boolean {
  if (left.kind === 'direct') return right.kind === 'direct'
  if (right.kind === 'direct') return false
  return left.context === right.context
}

function validateName(subject: string, value: string): void {
  if (!isTypertRemoteSegment(value)) {
    throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`)
  }
}
