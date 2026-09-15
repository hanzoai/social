// Writing one thing and sending it to several networks.
//
// ONE POST PER NETWORK, and the screen says so rather than hiding it. A post on
// this platform carries ONE channel — `POST /v1/social/posts` takes `channel`, a
// single network — so picking four networks stores four posts. That is the
// truthful shape, and it is also the useful one: each has its own state, its own
// failure and its own id to publish, which is what a person wants when LinkedIn
// takes it and TikTok refuses it.
//
// It is also what makes writing separately for one network free. The words for
// X are just a different `content` on the X row; nothing has to be modelled to
// support it, and a network that has not been taken aside simply carries the
// shared words.
//
// MEDIA IS AN ADDRESS. A post carries `media` as a list of URLs, and there is no
// upload on this surface — the platform mints presigned URLs that EXPIRE, and an
// address that expires is not one a network can fetch from when the post goes
// out hours later. So the composer takes addresses that are already public,
// reads each one's kind off its extension, and shows it: a video is ordinary
// content here, not a second kind of post.

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'

import { Act, Failed, Ready, Screen } from '~/page'
import { Mark, tone } from '~/status'
import { MEDIA, check, kind, rule } from '~/network'
import { fromField, now, toField } from '~/time'
import { useHttp } from '~/client'
import { publish, useAccounts, useNetworks, why, write } from '~/social'

/** What came of sending, network by network. */
interface Outcome {
  provider: string
  status: string
  says: string
}

/** The shared tab. Not a network, so it cannot collide with a provider id. */
const SHARED = ''

/** One media address: what it is, and a look at it. */
function Item({ url, forget }: { url: string; forget: () => void }) {
  const is = kind(url)
  return (
    <YStack width={132} gap="$1" p="$2" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <Box className="media" rounded="$2" overflow="hidden">
        {is === 'video' ? (
          // `controls` and nothing else: no autoplay, no loop. A composer that
          // starts playing four videos at once is a composer nobody can think in.
          <video src={url} controls preload="metadata" />
        ) : is === 'image' ? (
          <img src={url} alt="" loading="lazy" />
        ) : null}
      </Box>
      <XStack items="center" gap="$1">
        <Text fontSize="$1" color={is === 'unknown' ? '$ink' : '$soft'} flex={1} numberOfLines={1}>
          {is === 'unknown' ? 'unknown kind' : is}
        </Text>
        <Box
          render="button"
          onClick={forget}
          aria-label="Remove this media"
          p="$1"
          rounded="$2"
          bg="transparent"
          borderWidth={0}
          hoverStyle={{ bg: '$hover' }}
        >
          <Trash2 size={12} aria-hidden />
        </Box>
      </XStack>
    </YStack>
  )
}

/** The writing surface. One shape, so the shared words and a network's own
 *  words are visibly the same thing rather than two different editors. */
function Words({
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        resize: 'vertical',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        outline: 'none',
        color: 'inherit',
        font: 'inherit',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    />
  )
}

export function Compose() {
  const http = useHttp()
  const networks = useNetworks(http)
  const accounts = useAccounts(http)

  const [shared, setShared] = useState('')
  /** The networks written separately. A key present means this network has been
   *  taken off the shared words, even when the words are momentarily the same —
   *  which is why it is a map with an entry and not a comparison. */
  const [apart, setApart] = useState<Record<string, string>>({})
  const [media, setMedia] = useState<string[]>([])
  const [address, setAddress] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [tab, setTab] = useState<string>(SHARED)
  const [at, setAt] = useState('')
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome[] | null>(null)

  const when = fromField(at)
  const all = networks.it ?? []

  /** What this network will actually carry. */
  const words = (provider: string) => apart[provider] ?? shared

  // A connected account is what a publish fans out to, so the composer counts
  // them per network — a picked network with none stores a post with nowhere
  // to go, and says so rather than letting it be discovered later.
  const targets = (provider: string) =>
    (accounts.it ?? []).filter((a) => a.provider === provider && a.status === 'connected').length

  const complaints = Object.fromEntries(
    picked.map((p) => [p, check(p, words(p), media)]),
  ) as Record<string, string[]>
  const blocked = picked.some((p) => (complaints[p] ?? []).length > 0)

  const pick = (provider: string) => {
    const on = picked.includes(provider)
    setPicked(on ? picked.filter((p) => p !== provider) : [...picked, provider])
    // A network taken out of the post takes its own words with it. Leaving them
    // behind means picking it again silently restores words the person thought
    // they had discarded.
    if (on) {
      setApart(Object.fromEntries(Object.entries(apart).filter(([k]) => k !== provider)))
      if (tab === provider) setTab(SHARED)
    }
  }

  const addMedia = () => {
    const url = address.trim()
    if (!url || media.includes(url) || media.length >= MEDIA) return
    setMedia([...media, url])
    setAddress('')
  }

  /**
   * Store one post per picked network, and — when the person asked for it to go
   * now — publish each.
   *
   * Sequential rather than parallel: each network's outcome is reported on its
   * own row, and a fan-out that raced would report them in whatever order the
   * gateway answered. Every outcome is recorded, refusals included, because the
   * platform's 503 names exactly which credentials this deployment is missing
   * and that sentence is the whole of what a person can act on.
   */
  const send = async (go: boolean) => {
    if (!http || sending || picked.length === 0 || blocked) return
    setSending(true)
    setOutcome(null)
    const got: Outcome[] = []
    for (const provider of picked) {
      try {
        const post = await write(http, {
          content: words(provider),
          channel: provider,
          media,
          scheduleAt: go ? 0 : when,
          status: go || !when ? 'draft' : 'scheduled',
        })
        if (!go) {
          got.push({
            provider,
            status: post.status,
            says: post.status === 'scheduled' ? 'Scheduled.' : 'Saved as a draft.',
          })
          continue
        }
        // A publish is addressed BY ID, so a create that answered no id has
        // nothing to publish — and building the address anyway sends
        // `/posts/undefined/publish`, which is a request to a route nobody
        // serves and an error that blames the wrong step.
        if (!post?.id) {
          got.push({
            provider,
            status: 'failed',
            says: 'The platform answered without a post id, so there is nothing to publish.',
          })
          continue
        }
        const sent = await publish(http, post.id)
        got.push({
          provider,
          status: sent.status,
          says: sent.error || (sent.status === 'published' ? 'Published.' : sent.status),
        })
      } catch (e) {
        got.push({ provider, status: 'failed', says: why(e) })
      }
    }
    setOutcome(got)
    setSending(false)
    // The words stay. A fan-out where one network refused is one somebody is
    // about to retry, and clearing the box would take the post with it.
  }

  const showing = tab && picked.includes(tab) ? tab : SHARED
  const it = showing ? rule(showing) : null
  const said = showing ? (complaints[showing] ?? []) : []
  const text = showing ? words(showing) : shared
  const cap = it ? it.text : picked.length ? Math.min(...picked.map((p) => rule(p).text)) : 0

  return (
    <Ready>
      <Screen title="Compose" says="Write it once. It is stored as one post per network.">
        <XStack gap="$5" flexWrap="wrap" items="flex-start">
          <YStack flex={1} minW={320} gap="$3">
            {/* THE TABS ARE THE NETWORKS PICKED, plus the shared words they all
                start from. A network's tab is where it stops sharing them. */}
            {picked.length ? (
              <XStack gap="$1" flexWrap="wrap">
                <Act onPress={() => setTab(SHARED)} loud={showing === SHARED}>
                  Everyone
                </Act>
                {picked.map((p) => (
                  <Act key={p} onPress={() => setTab(p)} loud={showing === p}>
                    {rule(p).name}
                    {apart[p] !== undefined ? ' ·' : ''}
                  </Act>
                ))}
              </XStack>
            ) : null}

            <YStack gap="$2">
              {showing && apart[showing] === undefined ? (
                <YStack gap="$2">
                  <Words
                    value={shared}
                    onChange={setShared}
                    placeholder="What is going out?"
                    rows={6}
                  />
                  <XStack items="center" gap="$2">
                    <Text fontSize="$1" color="$quiet" flex={1}>
                      {it!.name} is carrying the shared words.
                    </Text>
                    <Act onPress={() => setApart({ ...apart, [showing]: shared })}>
                      Write separately for {it!.name}
                    </Act>
                  </XStack>
                </YStack>
              ) : showing ? (
                <YStack gap="$2">
                  <Words
                    value={text}
                    onChange={(v) => setApart({ ...apart, [showing]: v })}
                    placeholder={`What is going out on ${it!.name}?`}
                    rows={6}
                  />
                  <XStack items="center" gap="$2">
                    <Text fontSize="$1" color="$quiet" flex={1}>
                      Only {it!.name} carries these words.
                    </Text>
                    <Act
                      onPress={() =>
                        setApart(
                          Object.fromEntries(
                            Object.entries(apart).filter(([k]) => k !== showing),
                          ),
                        )
                      }
                    >
                      Back to the shared words
                    </Act>
                  </XStack>
                </YStack>
              ) : (
                <Words value={shared} onChange={setShared} placeholder="What is going out?" />
              )}

              <Text fontSize="$1" color={cap && text.length > cap ? '$ink' : '$quiet'}>
                {text.length}
                {cap ? ` of ${cap}` : ''} characters
                {cap && !showing ? ' — the tightest limit among the networks picked' : ''}
              </Text>

              {said.length ? (
                // The one inversion in the writing column, and it is the same
                // thing the send control is: something to act on before anything
                // can go out.
                <YStack gap="$1" px="$3" py="$2" rounded="$3" bg="$ink">
                  {said.map((line) => (
                    <Text key={line} fontSize="$1" color="$background" fontWeight="500">
                      {line}
                    </Text>
                  ))}
                </YStack>
              ) : null}
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                Media
              </Text>
              <XStack gap="$2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMedia()}
                  placeholder="https://… a photo or a video"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    outline: 'none',
                    color: 'inherit',
                    font: 'inherit',
                    fontSize: 13,
                  }}
                />
                <Act onPress={addMedia} disabled={!address.trim() || media.length >= MEDIA}>
                  Add
                </Act>
              </XStack>
              <Text fontSize="$1" color="$quiet">
                An address the network can fetch — up to {MEDIA}, shared by every
                network in this post. A video counts the same as a photo here;
                which networks will take it is on the right.
              </Text>
              {media.length ? (
                <XStack gap="$2" flexWrap="wrap">
                  {media.map((url) => (
                    <Item
                      key={url}
                      url={url}
                      forget={() => setMedia(media.filter((m) => m !== url))}
                    />
                  ))}
                </XStack>
              ) : null}
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                When
              </Text>
              <XStack items="center" gap="$2" flexWrap="wrap">
                <input
                  type="datetime-local"
                  value={at}
                  min={toField(now())}
                  onChange={(e) => setAt(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    outline: 'none',
                    color: 'inherit',
                    font: 'inherit',
                    fontSize: 13,
                    colorScheme: 'dark light',
                  }}
                />
                {at ? (
                  <Act onPress={() => setAt('')}>Clear</Act>
                ) : (
                  <Text fontSize="$1" color="$quiet">
                    Leave it empty to keep this as a draft.
                  </Text>
                )}
              </XStack>
            </YStack>

            <XStack gap="$2" items="center" flexWrap="wrap">
              <Act
                onPress={() => void send(true)}
                disabled={sending || picked.length === 0 || blocked}
                loud
              >
                {sending ? 'Sending…' : 'Post now'}
              </Act>
              <Act
                onPress={() => void send(false)}
                disabled={sending || picked.length === 0 || blocked}
              >
                {when ? 'Schedule' : 'Save draft'}
              </Act>
              <Text fontSize="$1" color="$quiet">
                {picked.length === 0
                  ? 'Pick at least one network.'
                  : `${picked.length} post${picked.length === 1 ? '' : 's'} will be stored.`}
              </Text>
            </XStack>

            {outcome ? (
              <YStack gap="$2">
                <Text fontSize="$3" fontWeight="500" color="$ink">
                  What happened
                </Text>
                {outcome.map((one) => (
                  <YStack
                    key={one.provider}
                    gap="$1"
                    p="$3"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <XStack items="center" gap="$3">
                      <Text fontSize="$2" color="$ink" flex={1}>
                        {rule(one.provider).name}
                      </Text>
                      <Mark of={tone(one.status)} says={one.status} />
                    </XStack>
                    <Text fontSize="$1" color="$soft">
                      {one.says}
                    </Text>
                  </YStack>
                ))}
              </YStack>
            ) : null}
          </YStack>

          <YStack width={320} shrink={0} gap="$2">
            <Text fontSize="$3" fontWeight="500" color="$ink">
              Networks
            </Text>
            {networks.failed ? <Failed what="the networks" why={networks.failed} /> : null}
            {all.map((n) => {
              const on = picked.includes(n.provider)
              const problems = on ? (complaints[n.provider] ?? []) : []
              const r = rule(n.provider)
              return (
                <YStack
                  key={n.provider}
                  rounded="$3"
                  borderWidth={1}
                  borderColor={on ? '$ink' : '$borderColor'}
                  overflow="hidden"
                >
                  <Box
                    render="button"
                    onClick={() => pick(n.provider)}
                    aria-pressed={on}
                    width="100%"
                    p="$3"
                    bg="transparent"
                    borderWidth={0}
                    hoverStyle={{ bg: '$hover' }}
                  >
                    {/* A gui button centres its children; a card's text reads
                        from the left edge. */}
                    <YStack gap="$1" width="100%" items="flex-start">
                      <XStack items="center" gap="$2" width="100%">
                        <Text fontSize="$2" color={on ? '$ink' : '$soft'} flex={1} text="left">
                          {r.name}
                        </Text>
                        <Text fontSize="$1" color="$quiet">
                          {targets(n.provider)} account
                          {targets(n.provider) === 1 ? '' : 's'}
                        </Text>
                      </XStack>
                      <Text fontSize="$1" color="$quiet" text="left">
                        {r.text} characters
                        {r.needs === 'video'
                          ? ' · the video is the post'
                          : r.needs === 'media'
                            ? ' · needs a photo or a video'
                            : ''}
                        {r.videos > 0 && !r.mix ? ' · video cannot carry photos' : ''}
                        {r.videos === 0 ? ' · no video' : ''}
                      </Text>
                    </YStack>
                  </Box>
                  {problems.length ? (
                    <YStack gap="$1" px="$3" py="$2" bg="$ink">
                      {problems.map((line) => (
                        <Text key={line} fontSize="$1" color="$background" fontWeight="500">
                          {line}
                        </Text>
                      ))}
                    </YStack>
                  ) : null}
                  {on && targets(n.provider) === 0 ? (
                    <Text fontSize="$1" color="$soft" px="$3" py="$2">
                      No connected account on {r.name} — the post will be stored with
                      nowhere to go.
                    </Text>
                  ) : null}
                </YStack>
              )
            })}
          </YStack>
        </XStack>
      </Screen>
    </Ready>
  )
}
