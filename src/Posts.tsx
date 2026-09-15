// Everything written, in whatever state it is in.
//
// ONE LIST, FILTERED — not a screen per state. Drafts, the queue and what has
// gone out are the same rows with a different `status`, and the platform filters
// on it (`GET /v1/social/posts?status=`), so three screens would be three reads
// of one thing and three places for the row to be drawn differently.

import { useState } from 'react'
import { XStack, YStack } from '@hanzo/ui'

import { Act, Ready, Failed, Nothing, Screen } from '~/page'
import { Full } from '~/post'
import { useHttp } from '~/client'
import { usePosts } from '~/social'

/** The states a person filters by. `publishing` is not here: it is a claim held
 *  for the length of one attempt, not a state anything rests in. */
const STATES = [
  { status: '', label: 'Everything' },
  { status: 'draft', label: 'Drafts' },
  { status: 'scheduled', label: 'Queue' },
  { status: 'published', label: 'Published' },
  { status: 'failed', label: 'Failed' },
] as const

export function Posts() {
  const http = useHttp()
  const [state, setState] = useState('')
  const posts = usePosts(http, state || undefined)
  const label = STATES.find((s) => s.status === state)?.label ?? 'Everything'

  return (
    <Ready>
      <Screen title="Posts" says="Drafts, the queue, and everything that has gone out.">
        <YStack gap="$3" flex={1} minH={0}>
          <XStack gap="$2" flexWrap="wrap">
            {STATES.map(({ status, label: name }) => (
              <Act key={status || 'all'} onPress={() => setState(status)} loud={state === status}>
                {name}
              </Act>
            ))}
          </XStack>

          {posts.failed ? (
            <Failed what="the posts" why={posts.failed} />
          ) : (posts.it ?? []).length === 0 ? (
            <Nothing
              says={
                state
                  ? `Nothing in ${label.toLowerCase()}.`
                  : 'Nothing written yet. Compose one and it appears here.'
              }
            />
          ) : (
            <YStack>
              {(posts.it ?? []).map((post) => (
                <Full key={post.id} post={post} again={posts.again} />
              ))}
            </YStack>
          )}
        </YStack>
      </Screen>
    </Ready>
  )
}
