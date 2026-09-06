import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Hanzo Social — Next config. Same contract as the console's: Hanzo GUI is consumed
 * at RUNTIME (no optimizing compiler — the published @hanzogui/next-plugin has a
 * broken dependency), so the Gui ESM packages are transpiled by Next and GuiProvider
 * injects CSS at runtime; `react-native` aliases to `react-native-web` in the browser.
 *
 * There is no rewrite table here on purpose: `/v1/social/*` is SAME-ORIGIN and served
 * by the cloud binary at this host (the social.hanzo.ai edge routes /v1 to cloud-api),
 * so the browser calls its own origin and cloud resolves the org from the validated
 * session — no proxy, no key, no prefix.
 */
const __dirname = dirname(fileURLToPath(import.meta.url))

/** Every installed `@hanzogui/*` package, discovered (not hardcoded). */
function guiPackages() {
  let scoped = []
  try {
    scoped = readdirSync(join(__dirname, 'node_modules', '@hanzogui')).map((n) => `@hanzogui/${n}`)
  } catch {
    scoped = []
  }
  return ['@hanzo/gui', '@hanzo/ui', 'react-native-web', ...scoped]
}

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  transpilePackages: guiPackages(),
  experimental: { esmExternals: true },
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, 'react-native$': 'react-native-web' }
    // Gui flags the platform by extension: `.web.*` FIRST makes every RN-flavoured
    // dependency (react-native-svg, which the icon set pulls) resolve its web build
    // instead of the Flow-typed native one webpack cannot parse.
    config.resolve.extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', ...config.resolve.extensions]
    return config
  },
}
