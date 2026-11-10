/**
 * The administration console as a page of its own, through the assembled Web
 * profile and a real browser.
 *
 * What this proves, and what no unit test can: the Host answers `/admin` with
 * the application document, the console takes that page instead of the
 * workbench frame, every administration page the shipped composition offers
 * renders inside it, and the workbench keeps none of them.
 */
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFailed, onTestFinished } from 'vitest'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { saveFailureShot } from './support.ts'

/** The administration pages the shipped Web composition offers, by their own English names. */
const PAGES = ['Agent presets', 'Models', 'Built-in plugins'] as const

it('serves the console at its own path and keeps administration out of the workbench', async () => {
  const resources: { scaffold?: WebScaffold; browser?: Browser } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally { await resources.scaffold?.close() }
  })
  const scaffold = await launchWebScaffold()
  resources.scaffold = scaffold
  const browser = await chromium.launch()
  resources.browser = browser
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const tripwire = watchConsole(page)
  onTestFailed(() => saveFailureShot(page, 'admin-console'))

  // The launch URL establishes the browser session and lands on the workbench.
  await page.goto(scaffold.authenticatedUrl)
  await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor()
  expect(await page.getByRole('navigation', { name: 'Administration', exact: true }).count()).toBe(0)

  // Settings keeps one plane: what a person decides for themselves.
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
  await dialog.getByRole('button', { name: 'General', exact: true }).waitFor()
  for (const name of PAGES) {
    expect(await dialog.getByRole('button', { name, exact: true }).count(), name).toBe(0)
  }
  await page.keyboard.press('Escape')

  // The console is a URL, not a panel.
  await page.goto(new URL('/admin', scaffold.baseUrl).href)
  const nav = page.getByRole('navigation', { name: 'Administration', exact: true })
  await nav.waitFor()
  for (const name of PAGES) await nav.getByRole('button', { name, exact: true }).waitFor()
  // The lowest-ordered page opens with the console; Models declares order 10.
  // The console's header is the h1; the page's own section heading is an h2.
  const title = page.locator('h1')
  await expect.poll(() => title.innerText()).toBe('Models')
  await expect.poll(() => nav.getByRole('button', { name: 'Models', exact: true }).getAttribute('aria-current'))
    .toBe('page')
  await nav.getByRole('button', { name: 'Agent presets', exact: true }).click()
  await expect.poll(() => title.innerText()).toBe('Agent presets')
  await expect.poll(() => nav.getByRole('button', { name: 'Agent presets', exact: true }).getAttribute('aria-current'))
    .toBe('page')

  // No accounts in this composition: nobody is named, and the way back is a
  // link. Both sit in the column's footer, beside the navigation.
  await page.getByText('Nobody is signed in', { exact: true }).waitFor()
  expect(await page.getByRole('link', { name: 'Sign out', exact: true }).count()).toBe(0)
  await page.getByRole('link', { name: 'Open the workbench', exact: true }).click()
  await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor()
  expect(await page.getByRole('navigation', { name: 'Administration', exact: true }).count()).toBe(0)

  expect(tripwire.warnings).toEqual([])
  expect(tripwire.pageErrors).toEqual([])
}, 180_000)
