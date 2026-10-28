// @vitest-environment jsdom
/**
 * Applying the deployment's palette for exactly the owning plugin lifetime: a
 * brand plugin that unloads must leave the built-in palette behind, so the
 * removal matters as much as the set.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { installDeploymentColours } from '../src/client/deployment-colours.ts'

const GLOBAL = 'dshDeploymentBrand'

function withBrand(brand: unknown): void {
  Reflect.set(globalThis, GLOBAL, brand)
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, GLOBAL)
  document.documentElement.removeAttribute('style')
})

describe('deployment colour overrides on the page', () => {
  it('sets the replaced tokens on the document element and removes them on dispose', async () => {
    withBrand({ colors: { blue: '#123456', grey: '#ffffff', gray50: 'white' } })
    const ctx = new Context()
    const fiber = ctx.plugin({ apply(scope) { installDeploymentColours(scope) } })
    await fiber.await()

    const style = document.documentElement.style
    expect(style.getPropertyValue('--DeepSeek Harness-blue')).toBe('#123456')
    expect(style.getPropertyValue('--DeepSeek Harness-gray-50')).toBe('white')
    expect(style.getPropertyValue('--DeepSeek Harness-grey')).toBe('')

    await fiber.dispose()
    expect(document.documentElement.getAttribute('style')).toBe('')
  })

  it('leaves the palette untouched when the page replaced no token', async () => {
    withBrand({ colors: { blue: 'url(data:,x)' } })
    const ctx = new Context()
    const fiber = ctx.plugin({ apply(scope) { installDeploymentColours(scope) } })
    await fiber.await()

    expect(document.documentElement.getAttribute('style')).toBeNull()
    await fiber.dispose()
  })
})
