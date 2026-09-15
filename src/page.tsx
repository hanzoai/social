// The shapes every screen shares: the heading, the state where nobody is signed
// in, and the way a refusal is reported.
//
// Six screens would otherwise grow six versions of each, and six versions of
// "this did not come back" are six different products in one window.

import type { ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'

import { enter } from '~/enter'
import { useTenant } from '~/client'

/** One screen: a heading, a sentence saying what it is for, and the screen. */
export function Screen({
  title,
  says,
  beside,
  children,
}: {
  title: string
  says: string
  /** A control that belongs with the heading rather than in the body. */
  beside?: ReactNode
  children: ReactNode
}) {
  return (
    <YStack flex={1} minH={0} gap="$4" p="$5">
      <XStack items="flex-start" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minW={220}>
          <Text render="h1" fontSize="$6" fontWeight="600" color="$ink">
            {title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {says}
          </Text>
        </YStack>
        {beside}
      </XStack>
      {children}
    </YStack>
  )
}

/** A plain control. One shape, so every button on this surface is one button. */
export function Act({
  onPress,
  children,
  disabled,
  loud,
}: {
  onPress: () => void
  children: ReactNode
  disabled?: boolean
  /**
   * The one control on the screen a person came to press.
   *
   * INVERTED, which on a monochrome palette is the loudest thing there is — so
   * it is spent once per screen. A second loud control is two firsts, and then
   * neither reads as the thing to do.
   */
  loud?: boolean
}) {
  return (
    <Box
      render="button"
      onClick={disabled ? undefined : onPress}
      aria-disabled={disabled}
      px="$3"
      py="$2"
      rounded="$3"
      borderWidth={1}
      borderColor={loud ? '$ink' : '$borderColor'}
      bg={loud ? '$ink' : 'transparent'}
      opacity={disabled ? 0.4 : 1}
      hoverStyle={disabled ? {} : { bg: loud ? '$ink' : '$hover' }}
    >
      <Text fontSize="$2" color={loud ? '$background' : '$ink'} fontWeight={loud ? '500' : '400'}>
        {children}
      </Text>
    </Box>
  )
}

/**
 * Why something did not come back, in the person's words.
 *
 * The platform's own sentence is kept — a 503 from the publish edge names the
 * exact credentials a deployment is missing, and that is the useful part —
 * prefixed with what was being read so the sentence has a subject.
 */
export function Failed({ what, why }: { what: string; why: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <Text fontSize="$2" color="$ink">
        Could not load {what}.
      </Text>
      <Text fontSize="$1" color="$soft">
        {why}
      </Text>
    </YStack>
  )
}

/** Nothing here yet, and what would put something here. */
export function Nothing({ says }: { says: string }) {
  return (
    <YStack items="center" justify="center" p="$6">
      <Text fontSize="$2" color="$quiet" text="center">
        {says}
      </Text>
    </YStack>
  )
}

/**
 * The screen, once there is somebody to read for and a tenant to read in.
 *
 * Every /v1/social route refuses a caller with no validated principal, so a
 * signed-out surface has nothing to show and no useful request to make. It says
 * so once, here, instead of six screens each filling with the same refusal.
 *
 * An account that belongs to several organizations and has picked none is the
 * other half of the same state: the requests would go out unscoped and the
 * gateway would answer for whichever org the token's owner claim names, which is
 * nobody's to work in.
 */
export function Ready({ children }: { children: ReactNode }) {
  const door = useIam()
  const { org, orgs } = useTenant()
  const { isAuthenticated, isLoading } = door

  if (isLoading) return <YStack flex={1} />

  if (!isAuthenticated) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
        <Text render="h1" fontSize="$6" fontWeight="600" color="$ink">
          Hanzo Social
        </Text>
        <Text fontSize="$2" color="$soft" text="center" maxW={420}>
          Write once, and publish to every account your organization owns — now,
          or at a time you pick.
        </Text>
        <Act onPress={() => void enter(door)} loud>
          Sign in
        </Act>
      </YStack>
    )
  }

  if (!org && orgs.length > 1) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$2" p="$6">
        <Text fontSize="$3" color="$ink">
          Pick an organization
        </Text>
        <Text fontSize="$2" color="$soft" text="center" maxW={420}>
          Accounts and posts belong to one organization. Choose which one you are
          working in, at the bottom of the column on the left.
        </Text>
      </YStack>
    )
  }

  return <>{children}</>
}
