// Public environment bindings injected at build/serve time by `hanzo serve`.
interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly VITE_HANZO_API?: string
  readonly VITE_HANZO_IAM?: string
  readonly VITE_HANZO_CLIENT_ID?: string
  readonly HANZO_API?: string
  readonly HANZO_IAM?: string
  readonly HANZO_CLIENT_ID?: string
  readonly [key: string]: string | boolean | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// A stylesheet is not a module with a type; these imports exist for their
// effect. `@hanzo/font/css` ships the woff2 and the `@font-face` that names it,
// and has no declaration of its own.
declare module '@hanzo/font/css'
declare module '*.css'
