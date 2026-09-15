// The chrome: the column of screens on the left, and whichever one is open
// beside it.
//
// The sidebar reads the SAME table the router does, so a screen is one entry in
// `routes.tsx` and never two that drift.

import { useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Check, ChevronDown } from 'lucide-react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { HanzoMark } from '@hanzo/ui/product'
import { NavLink, Outlet } from 'react-router'

import { enter } from '~/enter'
import { SCREENS } from '~/routes'
import { useTenant } from '~/client'

/**
 * Which organization this browser works in.
 *
 * THE ORG IS THE TENANT. Every account and every post belongs to one: the social
 * API resolves it from the validated bearer and filters every query by it, so
 * switching here changes everything on every screen. A sole organization is not
 * a choice and is drawn as a name.
 *
 * The social API carries no scope finer than this. It has no project column and
 * its listings filter by state and network only, so an account or a post cannot
 * be filed under anything below the org — which is why there is no second
 * switch here pretending otherwise.
 */
function Tenant() {
  const { org, orgs, choose } = useTenant()
  const [open, setOpen] = useState(false)

  if (orgs.length === 0) return null

  if (orgs.length === 1) {
    return (
      <Text fontSize="$1" color="$quiet" px="$3" numberOfLines={1}>
        {orgs[0]}
      </Text>
    )
  }

  return (
    <YStack gap="$1">
      <Box
        render="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        width="100%"
        px="$3"
        py="$2"
        rounded="$2"
        hoverStyle={{ bg: '$hover' }}
      >
        <XStack items="center" gap="$2">
          <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
            {org ?? 'Pick an organization'}
          </Text>
          <ChevronDown size={13} aria-hidden />
        </XStack>
      </Box>
      {open
        ? orgs.map((one) => (
            <Box
              key={one}
              render="button"
              onClick={() => {
                choose(one)
                setOpen(false)
              }}
              width="100%"
              px="$3"
              py="$2"
              rounded="$2"
              hoverStyle={{ bg: '$hover' }}
            >
              <XStack items="center" gap="$2">
                <Text fontSize="$2" color={one === org ? '$ink' : '$soft'} flex={1} numberOfLines={1}>
                  {one}
                </Text>
                {one === org ? <Check size={12} aria-hidden /> : null}
              </XStack>
            </Box>
          ))
        : null}
    </YStack>
  )
}

/** Who is signed in, and the way in or out. */
function Account() {
  const door = useIam()
  const { user, isAuthenticated, logout } = door
  const name =
    (user as { displayName?: string; name?: string; email?: string } | null)?.displayName ||
    (user as { name?: string } | null)?.name ||
    (user as { email?: string } | null)?.email ||
    ''

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
    <YStack gap="$1">
      <Text fontSize="$1" color="$quiet" px="$3" numberOfLines={1}>
        {name}
      </Text>
      <Box
        render="button"
        onClick={() => void logout()}
        px="$3"
        py="$2"
        rounded="$2"
        hoverStyle={{ bg: '$hover' }}
      >
        <Text fontSize="$2" color="$soft">
          Sign out
        </Text>
      </Box>
    </YStack>
  )
}

export function Frame() {
  return (
    <XStack className="shell" flex={1} minW={0} minH={0}>
      <YStack
        className="rail"
        width={232}
        shrink={0}
        minH={0}
        borderRightWidth={1}
        borderColor="$borderColor"
        py="$3"
        gap="$3"
      >
        <XStack items="center" gap="$2" px="$3">
          <HanzoMark size={18} />
          <Text fontSize="$3" fontWeight="500" color="$ink">
            Social
          </Text>
        </XStack>

        <YStack className="ways" gap="$1" px="$2" flex={1} minH={0} overflow="scroll">
          {SCREENS.map(({ path, label }) => (
            // NavLink rather than a Box with a handler: a person who wants this
            // screen in another tab reaches for the middle button, and a button
            // calling navigate() has no address for them to reach.
            <NavLink key={path} to={path} end={path === '/'} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <Box
                  px="$3"
                  py="$2"
                  rounded="$2"
                  bg={isActive ? '$hover' : 'transparent'}
                  hoverStyle={{ bg: '$hover' }}
                >
                  <Text fontSize="$2" color={isActive ? '$ink' : '$soft'}>
                    {label}
                  </Text>
                </Box>
              )}
            </NavLink>
          ))}
        </YStack>

        <YStack className="whose" gap="$2" px="$1" shrink={0}>
          <Tenant />
          <Account />
        </YStack>
      </YStack>

      <YStack flex={1} minW={0} minH={0} overflow="scroll">
        <Outlet />
      </YStack>
    </XStack>
  )
}
