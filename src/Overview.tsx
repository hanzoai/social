// What this organization has, in one read of each thing there is to read.
//
// Three reads and no derived state: the counts come from the platform's own
// roll-up rather than from counting a page of posts, because a page is bounded
// and a count of a bounded page is a count of the page.

import { Text, XStack, YStack } from '@hanzo/ui'
import { Link } from 'react-router'

import { Ready, Failed, Nothing, Screen } from '~/page'
import { Mark } from '~/status'
import { rule } from '~/network'
import { Row } from '~/post'
import { useHttp } from '~/client'
import { useNetworks, usePosts, useSummary } from '~/social'

/** One count, and what it counts. */
function Count({ of, says }: { of: number | null; says: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" flex={1} minW={0}>
      <Text fontSize="$7" fontWeight="600" color="$ink">
        {of ?? '—'}
      </Text>
      <Text fontSize="$1" color="$soft">
        {says}
      </Text>
    </YStack>
  )
}

export function Overview() {
  const http = useHttp()
  const summary = useSummary(http)
  const networks = useNetworks(http)
  const posts = usePosts(http)

  const ready = (networks.it ?? []).filter((n) => n.credentialsConfigured)
  const waiting = (networks.it ?? []).filter((n) => !n.credentialsConfigured)
  const recent = (posts.it ?? []).slice(0, 8)

  return (
    <Ready>
      <Screen
        title="Overview"
        says="Everything this organization has connected, written and sent."
      >
        {summary.failed ? (
          <Failed what="the roll-up" why={summary.failed} />
        ) : (
          <XStack gap="$3" flexWrap="wrap">
            <Count of={summary.it?.posts ?? null} says="Posts" />
            <Count of={summary.it?.scheduled ?? null} says="Scheduled" />
            <Count of={summary.it?.published ?? null} says="Published" />
            <Count of={summary.it?.accounts ?? null} says="Accounts" />
          </XStack>
        )}

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$ink">
            Networks
          </Text>
          {networks.failed ? (
            <Failed what="the networks" why={networks.failed} />
          ) : (
            <YStack gap="$2">
              <Text fontSize="$1" color="$soft">
                {ready.length} of {(networks.it ?? []).length} can publish from this deployment.
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {ready.map((n) => (
                  <Mark key={n.provider} of="up" says={rule(n.provider).name} />
                ))}
                {/*
                  A network whose credentials this deployment does not hold reads
                  `quiet`, not `act`: the missing item is an environment variable
                  on the server, which the person reading this screen cannot
                  supply. The Accounts screen names the variables for whoever can.
                */}
                {waiting.map((n) => (
                  <Mark key={n.provider} of="quiet" says={rule(n.provider).name} />
                ))}
              </XStack>
            </YStack>
          )}
        </YStack>

        <YStack gap="$2" flex={1} minH={0}>
          <XStack items="baseline" gap="$3">
            <Text fontSize="$3" fontWeight="500" color="$ink" flex={1}>
              Lately
            </Text>
            <Link to="/posts" style={{ textDecoration: 'none' }}>
              <Text fontSize="$1" color="$soft">
                All posts
              </Text>
            </Link>
          </XStack>
          {posts.failed ? (
            <Failed what="the posts" why={posts.failed} />
          ) : recent.length === 0 ? (
            <Nothing says="Nothing written yet. Compose one and it appears here." />
          ) : (
            <YStack>
              {recent.map((post) => (
                <Row key={post.id} post={post} />
              ))}
            </YStack>
          )}
        </YStack>
      </Screen>
    </Ready>
  )
}
