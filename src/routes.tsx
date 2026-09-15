import { createBrowserRouter } from 'react-router'

import { Accounts } from '~/Accounts'
import { Analytics } from '~/Analytics'
import { Calendar } from '~/Calendar'
import { Callback } from '~/callback'
import { Compose } from '~/Compose'
import { Frame } from '~/frame'
import { Overview } from '~/Overview'
import { Posts } from '~/Posts'
import { Root } from '~/root'

/**
 * Every address this app answers, in one table — and the same table the sidebar
 * reads, so a screen is one entry rather than two that drift.
 *
 * `/auth/callback` is where the issuer returns a browser, and it is the address
 * `origin()` registers, so it is a route of its own and NOT under the frame:
 * the chrome would draw a sidebar around a screen whose whole job is to
 * redirect.
 */
export const SCREENS = [
  { path: '/', label: 'Overview', element: <Overview /> },
  { path: '/compose', label: 'Compose', element: <Compose /> },
  { path: '/posts', label: 'Posts', element: <Posts /> },
  { path: '/calendar', label: 'Calendar', element: <Calendar /> },
  { path: '/accounts', label: 'Accounts', element: <Accounts /> },
  { path: '/analytics', label: 'Analytics', element: <Analytics /> },
] as const

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/auth/callback', element: <Callback /> },
      {
        element: <Frame />,
        children: [
          ...SCREENS.map(({ path, element }) => ({ path, element })),
          // An address nobody publishes lands on the overview rather than on a
          // page about the address being wrong. There is one product here and
          // the overview is where a person can see all of it.
          { path: '*', element: <Overview /> },
        ],
      },
    ],
  },
])
