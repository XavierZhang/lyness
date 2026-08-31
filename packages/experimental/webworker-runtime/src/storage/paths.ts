/**
 * Virtual root of the worker host's in-memory filesystem. Kept
 * in one module so the process shim, the path/os shims, and the VFS image
 * collector cannot drift apart.
 */

/** Virtual filesystem root; `process.cwd()` and every absolute path start here. */
export const LYNESS_ROOT = '/lyn'

/** `$LYNESS_HOME`: durable-state directory inside the image. */
export const LYNESS_HOME = `${LYNESS_ROOT}/home`

/** Flat, symlink-free package tree resolved by the worker module loader. */
export const LYNESS_NODE_MODULES = `${LYNESS_ROOT}/node_modules`

/** Directory holding the composed cordis.yml and the agent-preset tree. */
export const LYNESS_CONFIG = `${LYNESS_ROOT}/config`

/** Default (empty) workspace directory. */
export const LYNESS_WORKSPACE = `${LYNESS_ROOT}/workspace`

/** Temporary directory reported by `os.tmpdir()`. */
export const LYNESS_TMP = `${LYNESS_ROOT}/tmp`
