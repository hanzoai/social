import localFont from 'next/font/local';

/**
 * Plus Jakarta Sans — self-hosted (latin variable, weights 200–800, normal +
 * italic). Vendored so production builds stay hermetic: next/font/google fetches
 * the font from Google at build time, which hangs indefinitely on
 * restricted-egress CI runners. Defined once here and shared by every layout.
 */
export const jakartaSans = localFont({
  src: [
    {
      path: './plus-jakarta-sans-latin-variable.woff2',
      weight: '200 800',
      style: 'normal',
    },
    {
      path: './plus-jakarta-sans-latin-italic-variable.woff2',
      weight: '200 800',
      style: 'italic',
    },
  ],
  display: 'swap',
  fallback: ['sans-serif'],
});
