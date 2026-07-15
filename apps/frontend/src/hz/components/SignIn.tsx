// SignIn — the anonymous surface. hanzo.id OIDC only; there is no password
// field on this page, by design. Server-renderable (no hooks): the root page
// renders it when there is no session.
export function SignIn({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#4c37b8] text-2xl font-bold text-white shadow-lg shadow-[#7c5cff]/20">
          S
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Hanzo Social</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Plan, schedule, and publish across every channel — one queue, one calendar.
        </p>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error === 'exchange'
              ? 'Sign-in could not be completed. Please try again.'
              : 'Sign-in session expired. Please try again.'}
          </div>
        ) : null}

        <a
          href="/hz/auth/login"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6a49f2]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l7 4v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V7l7-4z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Sign in with Hanzo
        </a>
        <p className="mt-4 text-xs text-zinc-600">
          Secured by hanzo.id — your Hanzo identity, single sign-on.
        </p>
      </div>
    </div>
  );
}
