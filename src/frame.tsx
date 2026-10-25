// The chrome: the column of screens on the left, and whichever one is open
// beside it.
//
// The column is `@hanzo/ui/chat`'s Sidebar — the same rail hanzo.app wears —
// and the organization control is `@hanzo/ui/product`'s OrgSwitcher, the same
// one the console hoisted for every surface. The screen list is still the
// router's table, so a screen is one entry in `routes.tsx` and never two.

import { useCallback, useMemo } from 'react'
import { useIam } from '@hanzo/iam/react'
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  PenLine,
  Radio,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { Sidebar } from '@hanzo/ui/chat'
import { OrgSwitcher, UserMenu, type OrgScope } from '@hanzo/ui/product'
import { NavLink, Outlet } from 'react-router'

import { enter } from '~/enter'
import { SCREENS } from '~/routes'
import { useTenant } from '~/client'

const ICONS: Record<(typeof SCREENS)[number]['path'], LucideIcon> = {
  '/': LayoutDashboard,
  '/compose': PenLine,
  '/posts': ScrollText,
  '/calendar': CalendarDays,
  '/accounts': Radio,
  '/analytics': BarChart3,
}

/**
 * The organization this browser works in, pinned under the wordmark.
 *
 * PINNED, NOT SCROLLED. The screen list is the part that grows; the switcher
 * stays in the rail so a long menu cannot carry it off the page, and the menu
 * itself is the shared popover, which stays inside the viewport instead of
 * painting into the overflow the old in-flow list was clipped by.
 *
 * Social has no project under the organization — the API filters by the org
 * alone — so this is the only switch.
 */
function Tenant() {
  const { org, orgs, choose } = useTenant()
  const list = useMemo(
    () => orgs.map((one) => ({ name: one.name, displayName: one.displayName || one.name })),
    [orgs],
  )
  const load = useCallback(
    async (page: number, query: string) => {
      if (page > 0) return []
      const q = query.trim().toLowerCase()
      return list.filter(
        (one) =>
          !q ||
          one.name.toLowerCase().includes(q) ||
          one.displayName.toLowerCase().includes(q),
      )
    },
    [list],
  )
  const scope = useMemo<OrgScope>(
    () => ({
      currentOrg: () => org ?? '',
      setCurrentOrg: choose,
      isScopedAway: () => false,
      hasSelectedOrg: () => Boolean(org),
      enterOrg: choose,
      leaveOrg: () => {},
      switchOrg: choose,
    }),
    [org, choose],
  )
  const current = list.find((one) => one.name === org)

  if (!org) return null

  return (
    <YStack className="orgslot" shrink={0} px="$1">
      <OrgSwitcher
        scope={scope}
        orgs={list.length > 1 ? load : undefined}
        current={current}
        search={list.length > 8}
        direction="down"
        testId="org-switcher"
      />
    </YStack>
  )
}

/** Who is signed in. The account menu is the shared one, opening upward so it
 *  stays in the rail instead of falling off the bottom of the window. */
function Account() {
  const door = useIam()
  const { user, isAuthenticated, logout } = door
  const person = user as {
    displayName?: string
    name?: string
    email?: string
    avatar?: string
    picture?: string
  } | null
  const name = person?.displayName || person?.name || ''
  const email = person?.email || ''

  if (!isAuthenticated) {
    return (
      <Box
        render="button"
        onClick={() => void enter(door)}
        px="$3"
        py="$2"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        hoverStyle={{ bg: '$hover' }}
      >
        <Text fontSize="$2" color="$ink">
          Sign in
        </Text>
      </Box>
    )
  }

  return (
    <UserMenu
      name={name || email}
      email={email}
      avatar={person?.avatar || person?.picture}
      direction="up"
      align="start"
      onSignOut={() => void logout()}
      testId="account-menu"
    />
  )
}

export function Frame() {
  return (
    <XStack className="shell" flex={1} minW={0} minH={0}>
      <Sidebar className="rail">
        <XStack className="brand" items="center" px="$2" py="$1.5" shrink={0}>
          <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
            Hanzo Social
          </Text>
        </XStack>

        <Tenant />

        <YStack className="ways" flex={1} minH={0} overflow="scroll" gap="$1">
          {SCREENS.map(({ path, label }) => {
            const Icon = ICONS[path]
            return (
              <NavLink key={path} to={path} end={path === '/'} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <XStack
                    px="$2"
                    py="$1.5"
                    rounded="$3"
                    items="center"
                    gap="$2"
                    bg={isActive ? '$edge' : 'transparent'}
                    hoverStyle={{ bg: isActive ? '$edge' : '$hover' }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <YStack opacity={0.7}>
                      <Icon size={16} />
                    </YStack>
                    <Text
                      fontSize="$2"
                      numberOfLines={1}
                      flex={1}
                      color={isActive ? '$color' : '$quiet'}
                    >
                      {label}
                    </Text>
                  </XStack>
                )}
              </NavLink>
            )
          })}
        </YStack>

        <YStack className="whose" shrink={0} pt="$2" borderTopWidth={1} borderColor="$borderColor">
          <Account />
        </YStack>
      </Sidebar>

      <YStack flex={1} minW={0} minH={0} overflow="scroll">
        <Outlet />
      </YStack>
    </XStack>
  )
}
