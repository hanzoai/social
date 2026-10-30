// SIGNED OUT, EVERY ADDRESS DRAWS THE SAME ONE GATE.
//
// Every `/v1/social` route refuses a caller with no validated principal, so a
// signed-out surface has nothing to show and no useful request to make. `Ready`
// is what says so, once, for all six screens — and the second claim is the one
// worth a test: the app asks the platform for NOTHING. Six screens each filling
// with a 403 would look like six broken screens instead of one sign-in.

import { expect, test } from '@playwright/test'
import { SCREENS, pane, platform } from './platform'

/** The gate's own sentence. Nothing else on the surface says it. */
const SAYS = 'Write once, and publish to every account your organization owns'

for (const { path, title } of SCREENS) {
  test(`${path} asks nobody to read it and nothing of the platform`, async ({ page }) => {
    const seen = await platform(page)
    await page.goto(path)

    const screen = pane(page)
    await expect(page.getByRole('heading', { name: 'Hanzo Social', exact: true })).toBeVisible()
    await expect(screen.getByText(SAYS)).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()

    // The gate, not the screen: no heading, no rows, and no refusal reported as
    // though something had gone wrong.
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
    await expect(screen).not.toContainText('Could not load')

    // The chrome stays — the ways to every screen and the way in — because what
    // is missing is a reader, not the product.
    for (const way of SCREENS)
      await expect(page.locator('.ways').getByText(way.title, { exact: true })).toBeVisible()

    expect(seen.asked).toEqual([])
  })
}
