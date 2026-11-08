// A second module with `contribute`'s behaviour, for the cases that need two
// distinct plugin names: a contribution is dropped when the preset's rows
// already name the contributed plugin, so a case about a contribution landing
// cannot reuse one module for both sides.
export { inject, apply } from './contribute.js'
export const name = 'contribute-second'
