// SIGNED IN, WITH THE PLATFORM ANSWERING — EVERY SCREEN DRAWS ITS ROWS.
//
// The assertion that matters on every one of these is not that the screen
// mounted; it is that the PLATFORM'S OWN ROWS are on it. @hanzo/ai reads a
// collection out of a named envelope and answers an empty array for one shaped
// any other way, so a screen fed the wrong key draws a complete, calm, empty
// product — the calendar with a month and no posts on it, the analytics with
// "Nothing has failed." So each test names rows the fixtures carry and, where a
// screen has an empty state, asserts that sentence is NOT on it.

import { expect, test, type Page } from '@playwright/test'
import {
  ACCOUNTS,
  POSTS,
  REFUSAL,
  SCREENS,
  open,
  openMonth,
  pane,
  signedIn,
  tile,
} from './platform'

/** A day of the calendar's month, as the cell that holds it. */
const cell = (page: Page, date: number) =>
  page.locator('.month .day').filter({ has: page.getByText(String(date), { exact: true }) })

test('Overview counts the roll-up and lists what was written lately', async ({ page }) => {
  await signedIn(page)
  await open(page, '/', 'Overview')
  const screen = pane(page)

  // The four counts are the PLATFORM's, not a count of the page: the listing is
  // bounded and counting it would count the page.
  await expect(tile(page, 'Posts')).toContainText('5')
  await expect(tile(page, 'Scheduled')).toContainText('2')
  await expect(tile(page, 'Published')).toContainText('2')
  await expect(tile(page, 'Accounts')).toContainText('2')

  // Publish-readiness is per deployment and read live.
  await expect(screen.getByText('2 of 3 can publish from this deployment.')).toBeVisible()

  // Lately: a row per post, each with the post's own words.
  for (const post of POSTS) await expect(screen.getByText(post.content)).toBeVisible()
  await expect(screen).not.toContainText('Nothing written yet')
  await expect(screen).not.toContainText('Could not load')
})

test('Compose offers the networks the deployment carries and counts against the one picked', async ({
  page,
}) => {
  await signedIn(page)
  await open(page, '/compose', 'Compose')
  const screen = pane(page)

  // One card per network the platform named, each carrying its own limit and
  // how many accounts a publish would actually reach.
  const card = (name: string, says: string) =>
    screen.getByRole('button', { name: new RegExp(`^${name} ${says}`) })
  await expect(card('X', '1 account 280 characters')).toBeVisible()
  await expect(card('LinkedIn', '1 account 3000 characters')).toBeVisible()
  await expect(card('YouTube', '0 accounts 5000 characters')).toBeVisible()
  await expect(screen.getByText('Pick at least one network.')).toBeVisible()

  // Picking a network is what the composer is for: the tab appears, the counter
  // takes that network's cap, and the count of posts that would be stored is
  // stated rather than implied.
  await card('X', '1 account').click()
  await expect(card('X', '1 account')).toHaveAttribute('aria-pressed', 'true')
  await expect(screen.getByRole('button', { name: 'Everyone', exact: true })).toBeVisible()
  await expect(screen.getByRole('button', { name: 'X', exact: true })).toBeVisible()
  await expect(screen.getByText('0 of 280 characters')).toBeVisible()
  await expect(screen.getByText('1 post will be stored.')).toBeVisible()

  // The network's OWN rule, checked in the browser while the words can still be
  // cut — not discovered from a publish that fails hours later.
  await screen.getByPlaceholder('What is going out?').fill('n'.repeat(281))
  await expect(screen.getByText("1 characters over X's limit of 280.").first()).toBeVisible()

  // A network with no connected account stores a post with nowhere to go, and
  // says which network that is.
  await card('YouTube', '0 accounts').click()
  await expect(
    screen.getByText('No connected account on YouTube — the post will be stored with nowhere to go.'),
  ).toBeVisible()
})

test('Posts lists every state and filters to one at the platform', async ({ page }) => {
  const seen = await signedIn(page)
  await open(page, '/posts', 'Posts')
  const screen = pane(page)

  for (const post of POSTS) await expect(screen.getByText(post.content)).toBeVisible()
  await expect(screen).not.toContainText('Nothing written yet')
  // A failed post carries the platform's own reason, whole.
  await expect(screen.getByText(REFUSAL)).toBeVisible()
  // The controls the platform actually serves: move it, send it, forget it.
  await expect(screen.getByRole('button', { name: 'Publish now' })).toHaveCount(2)
  await expect(screen.getByRole('button', { name: 'Try again' })).toHaveCount(1)
  await expect(screen.getByRole('button', { name: 'Delete' })).toHaveCount(POSTS.length)

  // ONE LIST, FILTERED — and the filtering is the platform's, not the page's.
  await screen.getByRole('button', { name: 'Failed', exact: true }).click()
  await expect(screen.getByText('The one that did not go out.')).toBeVisible()
  await expect(screen.getByText('Shipping the calendar today.')).toHaveCount(0)
  expect(seen.asked).toContain('GET /v1/social/posts?status=failed')

  // An empty state is a sentence about that state, not the blank one.
  await screen.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(screen.getByText('Nothing in drafts.')).toBeVisible()
})

test('Calendar puts every post on its day, and opens the one picked', async ({ page }) => {
  await signedIn(page)
  await open(page, '/calendar', 'Calendar')
  const screen = pane(page)

  await expect(screen.getByText(openMonth(), { exact: true })).toBeVisible()
  await expect(page.locator('.month .day')).not.toHaveCount(0)

  // THE POSTS ARE ON THE GRID. Five posts, five marks — a month drawn with no
  // posts on it is the failure this whole file is written against.
  await expect(page.locator('.month .day button')).toHaveCount(POSTS.length)
  // Scheduled sits on the day it is DUE; everything else on the day it last
  // changed, which is the distinction the screen states rather than smooths.
  await expect(cell(page, 20).locator('button')).toHaveCount(3)
  await expect(cell(page, 24).locator('button')).toHaveCount(2)
  await expect(cell(page, 24).getByRole('button', { name: /YouTube/ })).toBeVisible()

  await expect(screen.getByText('Pick a post to move it, send it, or delete it.')).toBeVisible()
  await cell(page, 24).getByRole('button', { name: /YouTube/ }).click()

  // The same controls the posts screen offers, beside the day it is on.
  await expect(screen.getByText('Opened', { exact: true })).toBeVisible()
  await expect(screen.getByText('The launch film.')).toBeVisible()
  await expect(screen.getByLabel('When this post is due')).toBeVisible()
  await expect(screen.getByRole('button', { name: 'Publish now' })).toBeVisible()
  await expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  await expect(screen.getByText('Pick a post to move it, send it, or delete it.')).toHaveCount(0)
})

test('Accounts keeps the consent and the targets apart, network by network', async ({ page }) => {
  await signedIn(page)
  await open(page, '/accounts', 'Accounts')
  const screen = pane(page)

  // THE CONSENT — the org's credential, read from the provider plane.
  await expect(screen.getByText('Post to X as your organization.')).toBeVisible()
  await expect(screen.getByText('@acme · tweet.write, users.read')).toBeVisible()
  await expect(screen.getByRole('button', { name: 'Disconnect' })).toHaveCount(1)
  await expect(screen.getByRole('button', { name: 'Connect LinkedIn' })).toBeVisible()

  // A deployment that holds no app credentials for a network offers nothing to
  // press, and names the variables for whoever can set them — only the names.
  await expect(
    screen.getByText(
      'This deployment holds no app credentials for YouTube, so there is nothing to consent to yet.',
    ),
  ).toBeVisible()
  await expect(
    screen.getByText(
      'Publishing to YouTube also needs YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET set on the deployment.',
    ),
  ).toBeVisible()

  // THE TARGETS — the handles a publish fans out to, from the social plane.
  for (const account of ACCOUNTS)
    await expect(screen.getByText(account.handle, { exact: true })).toBeVisible()
  await expect(screen.getByText('Where posts go — 1 handle')).toHaveCount(2)
  await expect(screen.getByText('Where posts go — 0 handles')).toHaveCount(1)
  await expect(screen.getByRole('button', { name: 'Remove' })).toHaveCount(ACCOUNTS.length)

  // The catalog carries every connector the platform knows; this screen draws
  // only the networks a post can name. A Slack card would be wired to nothing.
  await expect(screen).not.toContainText('Slack')
  await expect(screen).not.toContainText('GitHub')
})

test('Analytics measures delivery, names what stopped, and claims no engagement', async ({
  page,
}) => {
  await signedIn(page)
  await open(page, '/analytics', 'Analytics')
  const screen = pane(page)

  // The share is taken from the ROLL-UP, because the listing is one page.
  await expect(screen.getByText('40%').first()).toBeVisible()
  await expect(screen.getByText('of what was written has gone out')).toBeVisible()
  await expect(screen.getByText(/2 published of 5 written/)).toBeVisible()

  // The delivery record, network by network, counted off the rows.
  await expect(screen.getByText('2 posts')).toHaveCount(2)
  await expect(screen.getByText('1 post', { exact: true })).toHaveCount(1)
  await expect(screen.getByText('1 failed', { exact: true })).toHaveCount(1)
  await expect(screen.getByText('1 scheduled', { exact: true })).toHaveCount(2)
  await expect(screen).not.toContainText('Nothing written yet, so there is nothing to measure.')

  // What stopped, in the platform's own sentence.
  await expect(screen.getByText('The one that did not go out.')).toBeVisible()
  await expect(screen.getByText(REFUSAL)).toBeVisible()
  await expect(screen).not.toContainText('Nothing has failed.')

  // And what it does not measure, said out loud rather than estimated.
  await expect(
    screen.getByText(
      'Engagement — views, likes, reach — is not recorded by this platform and nothing here estimates it.',
    ),
  ).toBeVisible()
})

test('every address this app asks for is one the platform serves', async ({ page }) => {
  const seen = await signedIn(page)
  for (const { path, title } of SCREENS) await open(page, path, title)

  // Nothing answered 404. A route that moved on the platform — the connector
  // plane was `/v1/integration` before it was `/v1/provider` — shows up here as
  // a path nothing served, on whichever screen still asks for it.
  expect(seen.unserved).toEqual([])

  const addresses = [...new Set(seen.asked.map((one) => one.split('?')[0]))].sort()
  expect(addresses).toEqual([
    'GET /v1/provider',
    'GET /v1/social/accounts',
    'GET /v1/social/posts',
    'GET /v1/social/providers',
    'GET /v1/social/summary',
  ])
})
