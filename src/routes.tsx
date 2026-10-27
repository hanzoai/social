import { createBrowserRouter } from 'react-router'

import { Accounts } from '~/Accounts'
import { Credentials } from '~/Credentials'
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
  { path: '/accounts', label: 'Connect', element: <Accounts /> },
  { path: '/settings', label: 'Keys', element: <Credentials /> },
  { path: '/compose', label: 'Post', element: <Compose /> },
  { path: '/calendar', label: 'Schedule', element: <Calendar /> },
  { path: '/', label: 'Overview', element: <Overview /> },
  { path: '/posts', label: 'Posts', element: <Posts /> },
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
