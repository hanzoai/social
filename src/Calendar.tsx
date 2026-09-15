// The month, and what is going out on each day of it.
//
// WHICH DAY A POST SITS ON depends on what the post is. A scheduled post has a
// `scheduleAt` and sits on that day. Anything else has no time of its own — the
// platform records no published-at — so it sits on `updatedAt`, which for a post
// that has gone out is the moment it went. The distinction is stated on the
// screen rather than smoothed over, because a calendar that quietly invents a
// date for half its rows is a calendar nobody can plan against.

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'

import { Act, Failed, Ready, Screen } from '~/page'
import { Full } from '~/post'
import { Mark, tone } from '~/status'
import { day, grid } from '~/time'
import { rule } from '~/network'
import { useHttp } from '~/client'
import { usePosts, type Post } from '~/social'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The day a post belongs on. */
const falls = (post: Post): string =>
  day(post.status === 'scheduled' && post.scheduleAt ? post.scheduleAt : post.updatedAt)

export function Calendar() {
  const http = useHttp()
  const posts = usePosts(http)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [opened, setOpened] = useState<string | null>(null)

  const days = grid(month.year, month.month)
  const byDay = new Map<string, Post[]>()
  for (const post of posts.it ?? []) {
    const key = falls(post)
    byDay.set(key, [...(byDay.get(key) ?? []), post])
  }
  const today = day(Math.floor(Date.now() / 1000))
  const open = (posts.it ?? []).find((p) => p.id === opened) ?? null

  const move = (by: number) => {
    const d = new Date(month.year, month.month + by, 1)
    setMonth({ year: d.getFullYear(), month: d.getMonth() })
    setOpened(null)
  }

  const named = new Date(month.year, month.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Ready>
      <Screen
        title="Calendar"
        says="Scheduled posts sit on the day they are due; everything else on the day it last changed."
        beside={
          <XStack items="center" gap="$2">
            <Box
              render="button"
              onClick={() => move(-1)}
              aria-label="The month before"
              p="$2"
              rounded="$2"
              bg="transparent"
              borderWidth={0}
              hoverStyle={{ bg: '$hover' }}
            >
              <ChevronLeft size={15} aria-hidden />
            </Box>
            <Text fontSize="$2" color="$ink" minW={140} text="center">
              {named}
            </Text>
            <Box
              render="button"
              onClick={() => move(1)}
              aria-label="The month after"
              p="$2"
              rounded="$2"
              bg="transparent"
              borderWidth={0}
              hoverStyle={{ bg: '$hover' }}
            >
              <ChevronRight size={15} aria-hidden />
            </Box>
            <Act onPress={() => move(0)}>Today</Act>
          </XStack>
        }
      >
        {posts.failed ? <Failed what="the calendar" why={posts.failed} /> : null}

        <YStack gap="$1">
          <div className="week">
            {WEEK.map((name) => (
              <Text key={name} fontSize="$1" color="$quiet" px="$1">
                {name}
              </Text>
            ))}
          </div>
          <div className="month">
            {days.map(({ key, date, inMonth }) => {
              const here = byDay.get(key) ?? []
              return (
                <YStack
                  key={key}
                  className="day"
                  gap="$1"
                  p="$1"
                  borderWidth={1}
                  borderColor="$borderColor"
                  rounded="$2"
                  bg={key === today ? '$hover' : 'transparent'}
                  opacity={inMonth ? 1 : 0.4}
                >
                  <Text fontSize="$1" color={key === today ? '$ink' : '$quiet'}>
                    {date.getDate()}
                  </Text>
                  {/* The opened post inverts. That is the same spend as anywhere
                      else — attention on one thing — and it is one thing by
                      construction, because only one post is open at a time. */}
                  {here.map((post) => (
                    <Box
                      key={post.id}
                      render="button"
                      onClick={() => setOpened(post.id === opened ? null : post.id)}
                      aria-pressed={post.id === opened}
                      width="100%"
                      px="$1"
                      py="$1"
                      rounded="$2"
                      bg={post.id === opened ? '$ink' : '$panel'}
                      borderWidth={0}
                      hoverStyle={{ bg: post.id === opened ? '$ink' : '$hover' }}
                    >
                      <YStack gap="$1" items="flex-start" width="100%">
                        <Text
                          fontSize="$1"
                          color={post.id === opened ? '$background' : '$soft'}
                          numberOfLines={1}
                          text="left"
                        >
                          {rule(post.channel).name}
                        </Text>
                        {post.id === opened ? null : (
                          <Mark of={tone(post.status)} says={post.status} />
                        )}
                      </YStack>
                    </Box>
                  ))}
                </YStack>
              )
            })}
          </div>
        </YStack>

        {open ? (
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="500" color="$ink">
              Opened
            </Text>
            <Full post={open} again={posts.again} />
          </YStack>
        ) : (
          <Text fontSize="$1" color="$quiet">
            Pick a post to move it, send it, or delete it.
          </Text>
        )}
      </Screen>
    </Ready>
  )
}
