/**
 * The invitation page as a page of its own, through the assembled Web profile
 * and a real browser.
 *
 * What this proves, and what no unit test can: the Host answers `/join` with
 * the application document, the page takes it instead of the workbench frame,
 * and it tells a link with no code apart from this composition — which serves
 * one operator and has nobody an invitation could admit.
 */
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFailed, onTestFinished } from 'vitest'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { saveFailureShot } from './support.ts'

it('serves the invitation page at its own path, and says what it can about the visit', async () => {
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
  onTestFailed(() => saveFailureShot(page, 'join-page'))

  // The launch URL establishes the browser session and lands on the workbench.
  await page.goto(scaffold.authenticatedUrl)
  await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor()

  // A link with no code at all: the page says so rather than offering
  // directories that would redeem nothing.
  await page.goto(new URL('/join', scaffold.baseUrl).href)
  const title = page.locator('h1')
  await expect.poll(() => title.innerText()).toBe('This link carries no invitation')
  // The workbench frame is not here: this page replaces it.
  expect(await page.getByRole('button', { name: 'Account menu', exact: true }).count()).toBe(0)

  // A link with a code, on a deployment that keeps no accounts: there is
  // nobody for an invitation to admit, and the page says that instead.
  await page.goto(new URL('/join?invite=not-a-real-code', scaffold.baseUrl).href)
  await expect.poll(() => title.innerText()).toBe('This deployment needs no invitation')

  // One way out of either of them: the product itself.
  await page.getByRole('link', { name: 'Open the workbench', exact: true }).click()
  await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor()

  expect(tripwire.warnings).toEqual([])
  expect(tripwire.pageErrors).toEqual([])
}, 180_000)
