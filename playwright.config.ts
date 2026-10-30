import { defineConfig, devices } from '@playwright/test'

/**
 * The e2e runner.
 *
 * THE SUBJECT IS THE BUILD THIS RUN MADE. `vite preview` serves the same `dist/`
 * the image ships, so a break in what is actually published cannot pass here —
 * and the build is the CI gate's first step anyway, so the specs cost one build
 * rather than a second toolchain.
 *
 * ITS OWN PORT, AND NEVER A SERVER IT FOUND. `vite.config.ts` pins 3300 because
 * that port is half of the IAM redirect_uri, so a person developing this app has
 * a dev server there — and `reuseExistingServer` would quietly make THAT the
 * subject, testing one tree's source against another tree's specs. The runner
 * takes the next port, always builds, and leaves the dev server alone. Nothing
 * here signs in through the issuer, so no redirect_uri is registered for this
 * port and none is needed.
 *
 * The locale and the zone are stated because the calendar's heading is
 * `toLocaleString(undefined, …)` — the browser's default — and a spec asserting
 * "March 2026" has to know which default it is reading.
 */
const PORT = 3301
const HOST = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: HOST,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: HOST,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
