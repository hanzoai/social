// ONE POST, AS EVERY PANE SHOWS IT.
//
// The overview lists it, the posts screen lists it with its controls, and the
// calendar puts it on a day and then wants the same controls beside it. Three
// copies of "what a post looks like" drift into three products, so the row and
// the controls live here and each screen mounts them.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act } from '~/page'
import { Mark, tone } from '~/status'
import { kind, rule } from '~/network'
import { at, fromField, since, toField } from '~/time'
import { useHttp } from '~/client'
import { drop, edit, why, type Post } from '~/social'

/** The post's words, or an honest stand-in for a post that is only media. */
export const said = (post: Post): string => post.content || '(no words — media only)'

/** What a post carries, as one line. */
export function Carries({ post }: { post: Post }) {
  const videos = post.media.filter((m) => kind(m) === 'video').length
  const images = post.media.length - videos
  if (!post.media.length) return null
  return (
    <Text fontSize="$1" color="$quiet">
      {images ? `${images} photo${images === 1 ? '' : 's'}` : ''}
      {images && videos ? ' · ' : ''}
      {videos ? `${videos} video${videos === 1 ? '' : 's'}` : ''}
    </Text>
  )
}

/** One post, as a list reads it. */
export function Row({ post }: { post: Post }) {
  return (
    <YStack gap="$2" py="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3">
        <Text fontSize="$2" color="$ink" flex={1} minW={0} numberOfLines={1}>
          {said(post)}
        </Text>
        <Text fontSize="$1" color="$quiet">
          {rule(post.channel).name}
        </Text>
        <Mark of={tone(post.status)} says={post.status} />
      </XStack>
      {post.error ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {post.error}
        </Text>
      ) : null}
      <XStack items="center" gap="$2">
        <Text fontSize="$1" color="$quiet">
          {post.status === 'scheduled' && post.scheduleAt
            ? `Due ${since(post.scheduleAt)}`
            : `Changed ${since(post.updatedAt)}`}
        </Text>
        <Carries post={post} />
      </XStack>
    </YStack>
  )
}

/**
 * What a person can do to a stored post from this screen, and nothing else.
 *
 * Move it in time (`PUT`) or forget it (`DELETE`). Sending it to a live audience
 * is not a control here. A post that has already gone out can only be deleted —
 * the platform has no unpublish, and a control that pretended otherwise would be
 * a lie about a post already on a network.
 *
 * A refusal is shown VERBATIM.
 */
export function Controls({ post, again }: { post: Post; again: () => void }) {
  const http = useHttp()
  const [busy, setBusy] = useState('')
  const [failed, setFailed] = useState<string | null>(null)
  const [when, setWhen] = useState(toField(post.scheduleAt))

  const run = async (what: string, go: () => Promise<unknown>) => {
    if (!http || busy) return
    setBusy(what)
    setFailed(null)
    try {
      await go()
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy('')
    }
  }

  const pending = post.status !== 'published'

  return (
    <YStack gap="$2">
      <XStack items="center" gap="$2" flexWrap="wrap">
        {pending ? (
          <>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="When this post is due"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
                outline: 'none',
                color: 'inherit',
                font: 'inherit',
                fontSize: 12,
                colorScheme: 'dark light',
              }}
            />
            <Act
              onPress={() =>
                void run('when', () =>
                  edit(http!, post, {
                    scheduleAt: fromField(when),
                    status: fromField(when) ? 'scheduled' : 'draft',
                  }),
                )
              }
              disabled={busy !== '' || toField(post.scheduleAt) === when}
              loud
            >
              {busy === 'when' ? 'Saving…' : fromField(when) ? 'Reschedule' : 'Unschedule'}
            </Act>
          </>
        ) : null}
        <Act onPress={() => void run('drop', () => drop(http!, post.id))} disabled={busy !== ''}>
          {busy === 'drop' ? 'Deleting…' : 'Delete'}
        </Act>
      </XStack>
      {failed || post.error ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {failed ?? post.error}
        </Text>
      ) : null}
    </YStack>
  )
}

/** One post with its controls — the shape the posts screen and the calendar
 *  both put on screen. */
export function Full({ post, again }: { post: Post; again: () => void }) {
  return (
    <YStack gap="$2" py="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack items="flex-start" gap="$3">
        <Text fontSize="$2" color="$ink" flex={1} minW={0} numberOfLines={3}>
          {said(post)}
        </Text>
        <Text fontSize="$1" color="$quiet">
          {rule(post.channel).name}
        </Text>
        <Mark of={tone(post.status)} says={post.status} />
      </XStack>
      <XStack items="center" gap="$2" flexWrap="wrap">
        <Text fontSize="$1" color="$quiet">
          {post.status === 'scheduled' && post.scheduleAt
            ? `Due ${at(post.scheduleAt)} · ${since(post.scheduleAt)}`
            : `Changed ${since(post.updatedAt)}`}
          {post.externalId ? ` · ${post.externalId}` : ''}
        </Text>
        <Carries post={post} />
      </XStack>
      <Controls post={post} again={again} />
    </YStack>
  )
}
