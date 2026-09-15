import { hanzo } from '@hanzo/vite'
import react from '@vitejs/plugin-react'

/**
 * The bundler. Resolving the Hanzo runtime — `~/…`, react-native-web, web-first
 * extensions, one copy of gui — comes from `hanzo()`, stated once for every
 * Hanzo app. What is left is this app's own.
 *
 * There is no CSS pipeline, and none is needed: @hanzo/ui ships one generated
 * stylesheet that `<Hanzo>` imports, and gui inserts the rules for props a
 * package could not have known about at first render.
 */
const API = 'https://api.hanzo.ai'

/**
 * Same-origin in front of the gateway, on the dev server and on the preview of
 * a build. api.hanzo.ai admits an origin by allowlist and by an https, portless
 * DNS proof; a localhost port satisfies neither, so a credentialed read to the
 * absolute address fails its preflight and every screen draws as though the org
 * had never connected an account. One statement, both servers — a proxy that
 * exists only under `vite dev` means the built output is never exercised
 * against real data before it ships.
 */
const proxy = { '/v1': { target: API, changeOrigin: true } }

/**
 * The port is pinned because it is half of a redirect. IAM returns a browser to
 * the `redirect_uri` the client registered, and that URI carries the port — so a
 * port the dev server picked because 3300 was busy is a port the issuer refuses
 * to return to, and the sign-in ends on an error page instead of this app.
 */
const PORT = 3300

/**
 * A single-page app has one document and many addresses, so every address that
 * is not a file has to arrive at that document. `ghcr.io/hanzoai/spa` answers
 * index.html for any route; a static plane resolves an object key and otherwise
 * answers the site's own `404.html`, so emitting the document under that name
 * is the whole fix and every static host already implements it.
 *
 * The status stays 404: the browser runs the bundle regardless and the router
 * takes the address from there, while a crawler reads "not a page I publish",
 * which is true of every address the router invents.
 */
const spaFallback = {
  name: 'spa-fallback',
  async writeBundle(options: { dir?: string }) {
    const { copyFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const dir = options.dir ?? 'dist'
    await copyFile(join(dir, 'index.html'), join(dir, '404.html'))
  },
}

const config = hanzo(
  {
    plugins: [react(), spaFallback],
    server: { port: PORT, allowedHosts: true, proxy },
    preview: { port: PORT, allowedHosts: true, proxy },
  },
  {
    root: import.meta.dirname,
    // ONE COPY OF THE THEME. `hanzo()` dedupes `@hanzo/gui` and `@hanzo/ui`, but
    // the theme and config contexts live a layer below them in `@hanzogui/core`.
    // A component rendered under one context reading the other throws
    // "Missing theme."
    dedupe: ['@hanzogui/core', '@hanzogui/web', '@hanzogui/portal', '@hanzogui/toast'],
  },
)

/**
 * Dependency optimization is a SECOND resolution pass and inherits none of the
 * first, so it is told the same thing: on the web, a react-native package's
 * `.web.js` sibling comes first. Left out, the optimizer follows react-native
 * into its Flow source and the dev server dies at startup, while `vite build`
 * uses the resolver above and succeeds.
 *
 * The list is read back from the config rather than restated.
 */
export default {
  ...config,
  optimizeDeps: {
    rollupOptions: {
      resolve: { extensions: (config.resolve as { extensions: string[] }).extensions },
    },
  },
}
