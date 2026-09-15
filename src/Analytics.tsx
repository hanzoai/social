// How the publishing itself is going.
//
// WHAT THE PLATFORM RECORDS is whether a post went out, through which account,
// what id the network gave it back, and why an attempt failed. It records NO
// engagement — no impressions, no views, no likes, no reach — and no endpoint on
// this surface serves any. So none is drawn. A tile reading "0 impressions"
// would be a measurement of nothing, and a sparkline under it would be a
// measurement of nothing over time.
//
// What IS here is the delivery record, which is the part that has an answer:
// where posts stand per network, and every failure with the platform's own
// reason for it.

import { Text, XStack, YStack } from '@hanzo/ui'

import { Ready, Failed, Nothing, Screen } from '~/page'
import { Mark, tone } from '~/status'
import { rule } from '~/network'
import { since } from '~/time'
import { useHttp } from '~/client'
import { usePosts, useSummary, type Post } from '~/social'

const STATES = ['published', 'scheduled', 'draft', 'failed'] as const

/** The delivery record for one network. */
interface Tally {
  provider: string
  total: number
  published: number
  scheduled: number
  draft: number
  failed: number
}

function tally(posts: Post[]): Tally[] {
  const by = new Map<string, Tally>()
  for (const post of posts) {
    const row =
      by.get(post.channel) ??
      { provider: post.channel, total: 0, published: 0, scheduled: 0, draft: 0, failed: 0 }
    row.total += 1
    if (post.status === 'published') row.published += 1
    else if (post.status === 'scheduled') row.scheduled += 1
    else if (post.status === 'failed') row.failed += 1
    else row.draft += 1
    by.set(post.channel, row)
  }
  return [...by.values()].sort((a, b) => b.total - a.total)
}

/** A share of a whole, drawn in the ramp: the bar is the top of it, the track
 *  is the surface under it. No hue, because a proportion has no category. */
function Share({ of, out }: { of: number; out: number }) {
  const part = out > 0 ? Math.round((of / out) * 100) : 0
  return (
    <XStack items="center" gap="$2" flex={1} minW={120}>
      <YStack flex={1} height={4} rounded={999} bg="$panel" overflow="hidden">
        <YStack width={`${part}%`} height={4} bg="$ink" />
      </YStack>
      <Text fontSize="$1" color="$quiet" minW={36} text="right">
        {part}%
      </Text>
    </XStack>
  )
}

export function Analytics() {
  const http = useHttp()
  const summary = useSummary(http)
  const posts = usePosts(http)
  const rows = posts.it ?? []
  const byNetwork = tally(rows)
  const failures = rows.filter((p) => p.status === 'failed' || p.error)
  const landed = summary.it ? summary.it.published : 0
  const written = summary.it ? summary.it.posts : 0

  return (
    <Ready>
      <Screen
        title="Analytics"
        says="What went out, where it went, and what stopped the rest."
      >
        {summary.failed ? <Failed what="the roll-up" why={summary.failed} /> : null}
        {posts.failed ? <Failed what="the posts" why={posts.failed} /> : null}

        <YStack gap="$2" p="$4" rounded="$3" borderWidth={1} borderColor="$borderColor">
          <XStack items="baseline" gap="$2">
            <Text fontSize="$7" fontWeight="600" color="$ink">
              {written ? `${Math.round((landed / written) * 100)}%` : '—'}
            </Text>
            <Text fontSize="$2" color="$soft">
              of what was written has gone out
            </Text>
          </XStack>
          <Share of={landed} out={written} />
          <Text fontSize="$1" color="$quiet">
            {landed} published of {written} written · {summary.it?.scheduled ?? 0} still
            queued · {summary.it?.accounts ?? 0} accounts connected. These four counts are
            the platform's own, taken over every row this organization has.
          </Text>
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$ink">
            By network
          </Text>
          {byNetwork.length === 0 ? (
            <Nothing says="Nothing written yet, so there is nothing to measure." />
          ) : (
            <YStack>
              {byNetwork.map((row) => (
                <YStack
                  key={row.provider}
                  gap="$2"
                  py="$3"
                  borderBottomWidth={1}
                  borderColor="$borderColor"
                >
                  <XStack items="center" gap="$3" flexWrap="wrap">
                    <Text fontSize="$2" color="$ink" minW={110}>
                      {rule(row.provider).name}
                    </Text>
                    <Share of={row.published} out={row.total} />
                    <Text fontSize="$1" color="$quiet" minW={70} text="right">
                      {row.total} post{row.total === 1 ? '' : 's'}
                    </Text>
                  </XStack>
                  <XStack gap="$3" flexWrap="wrap">
                    {/* A count of nothing is not a state. Zero reads `quiet`
                        whatever the state would otherwise be, or a network with
                        no failures draws the attention step five times. */}
                    {STATES.map((state) => (
                      <Mark
                        key={state}
                        of={row[state] ? tone(state) : 'quiet'}
                        says={`${row[state]} ${state}`}
                      />
                    ))}
                  </XStack>
                </YStack>
              ))}
            </YStack>
          )}
          <Text fontSize="$1" color="$quiet">
            Counted over the most recent {rows.length} post
            {rows.length === 1 ? '' : 's'} — the listing is a page, not the whole
            history, which is why the share above is taken from the roll-up instead.
          </Text>
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$ink">
            What stopped
          </Text>
          {failures.length === 0 ? (
            <Nothing says="Nothing has failed." />
          ) : (
            <YStack>
              {failures.map((post) => (
                <YStack
                  key={post.id}
                  gap="$1"
                  py="$3"
                  borderBottomWidth={1}
                  borderColor="$borderColor"
                >
                  <XStack items="center" gap="$3">
                    <Text fontSize="$2" color="$ink" flex={1} minW={0} numberOfLines={1}>
                      {post.content || '(no words — media only)'}
                    </Text>
                    <Text fontSize="$1" color="$quiet">
                      {rule(post.channel).name} · {since(post.updatedAt)}
                    </Text>
                  </XStack>
                  {/* The platform's own sentence, kept whole: it names the exact
                      credentials a deployment is missing, which is the part
                      anybody can act on. */}
                  <Text fontSize="$1" color="$ink" fontWeight="500">
                    {post.error || 'The platform recorded no reason.'}
                  </Text>
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>

        <Text fontSize="$1" color="$quiet">
          Engagement — views, likes, reach — is not recorded by this platform and
          nothing here estimates it.
        </Text>
      </Screen>
    </Ready>
  )
}
