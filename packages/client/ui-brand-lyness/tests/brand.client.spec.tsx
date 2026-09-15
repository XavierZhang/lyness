// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LynessHeroMark, LynessSidebarMark, LynessSidebarName } from '../src/client/Brand.tsx'
import { DEPLOYMENT_BRAND_GLOBAL, readDeploymentBrand } from '../src/client/deployment-brand.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function carryBrand(value: unknown): void {
  vi.stubGlobal(DEPLOYMENT_BRAND_GLOBAL, value)
}

describe('lyness artwork', () => {
  it('draws the lyness mark in the square each host requests', () => {
    const sidebar = render(<LynessSidebarMark size={24} />)
    const mark = sidebar.container.querySelector('svg')
    expect(mark?.getAttribute('viewBox')).toBe('0 0 717 619')
    expect(mark?.getAttribute('width')).toBe('24')
    expect(mark?.getAttribute('fill')).toBe('currentColor')
    expect(mark?.querySelectorAll('path')).toHaveLength(2)
    sidebar.unmount()

    const hero = render(<LynessHeroMark size={34} className="fish" />)
    const heroMark = hero.container.querySelector('svg')
    expect(heroMark?.getAttribute('height')).toBe('34')
    expect(heroMark?.getAttribute('class')).toBe('fish')
  })

  it('draws the lyness wordmark one sidebar row high', () => {
    const name = render(<LynessSidebarName />)
    const wordmark = name.container.querySelector('svg')
    expect(wordmark?.getAttribute('viewBox')).toBe('0 0 60.53 24')
    expect(wordmark?.getAttribute('height')).toBe('24')
  })
})

describe('deployment brand', () => {
  it('shows the deployment mark and wordmark in place of the lyness artwork', () => {
    carryBrand({ productName: 'Acme', markUrl: '/brand/mark.svg', wordmarkUrl: '/brand/wordmark.svg', showPoweredBy: false })

    const sidebar = render(<LynessSidebarMark size={24} />)
    expect(sidebar.container.querySelector('svg')).toBeNull()
    expect(sidebar.container.querySelector('img')?.getAttribute('src')).toBe('/brand/mark.svg')
    expect(sidebar.container.querySelector('img')?.getAttribute('width')).toBe('24')
    sidebar.unmount()

    const hero = render(<LynessHeroMark size={34} className="fish" />)
    expect(hero.container.querySelector('img')?.getAttribute('class')).toBe('fish')
    hero.unmount()

    const name = render(<LynessSidebarName />)
    expect(name.container.textContent).toBe('')
    expect(name.container.querySelector('img')?.getAttribute('src')).toBe('/brand/wordmark.svg')
  })

  it('shows the product name as text when the deployment has no wordmark', () => {
    carryBrand({ productName: 'Acme', showPoweredBy: false })
    expect(render(<LynessSidebarName />).container.textContent).toBe('Acme')
  })

  it('reads unusable members as absent', () => {
    carryBrand({ productName: '', markUrl: 'https://cdn.example/mark.svg', wordmarkUrl: '//cdn.example/wordmark.svg' })
    expect(readDeploymentBrand()).toEqual({})
    carryBrand({ productName: 42, markUrl: '/\\cdn.example/mark.svg', wordmarkUrl: 7 })
    expect(readDeploymentBrand()).toEqual({})
  })

  it('reads a missing or non-object global as no brand', () => {
    expect(readDeploymentBrand()).toEqual({})
    carryBrand(null)
    expect(readDeploymentBrand()).toEqual({})
    carryBrand('Acme')
    expect(readDeploymentBrand()).toEqual({})
  })
})
