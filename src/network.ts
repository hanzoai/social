// What each network will accept, and whether this post satisfies it.
//
// WHICH NETWORKS EXIST IS NOT DECIDED HERE. `GET /v1/social/providers` answers
// that, live, per deployment — so the composer draws the rows the platform
// names and this file only says how each one composes. A network the platform
// adds still works; it falls back to the platform's own caps until a rule for it
// lands here.
//
// The rules themselves are each network's OWN published limits, as this app
// understands them. No endpoint serves them, and none is claimed to: they are
// checked in the browser BEFORE the post is stored so a person learns that a
// caption is 40 characters too long while they can still cut it, rather than
// from a publish that fails later. A network can change its own rules, and when
// one does the correction is this table.
//
// Bluesky is not here because the platform does not carry it: the social API's
// channel vocabulary is x, facebook, instagram, linkedin, tiktok, youtube and
// threads, and a post created with any other channel is refused. A network this
// app drew but could not post to would be a control wired to nothing.

/** The platform's own cap on how many media URLs one post may carry. */
export const MEDIA = 10

/** What a network needs on a post before it will take it. */
export type Needs = 'nothing' | 'media' | 'video'

export interface Rule {
  /** What to call the network on screen. */
  name: string
  /** The network's cap on the post's text, in characters. */
  text: number
  /** What the network requires beyond the text. */
  needs: Needs
  /** How many videos the network takes in one post. Zero means none. */
  videos: number
  /** How many images the network takes in one post. */
  images: number
  /** Whether video and photos may travel together. Several networks take both
   *  kinds but not in the same post — the video becomes the whole post. */
  mix: boolean
}

/**
 * Each network's own limits.
 *
 * Every one of these takes video — which is why the composer treats video as
 * ordinary content rather than a second kind of post — and two of them take
 * nothing else: on TikTok and YouTube the video IS the post.
 *
 * `mix: false` is the rule that catches most people out. LinkedIn, TikTok and
 * YouTube all accept photos and all accept video, but never in one post: attach
 * a video and it becomes the whole post. A composer that let the two be
 * combined would produce a post the network refuses at the last moment.
 */
const RULES: Record<string, Rule> = {
  x: { name: 'X', text: 280, needs: 'nothing', videos: 1, images: 4, mix: true },
  facebook: { name: 'Facebook', text: 63206, needs: 'nothing', videos: 1, images: MEDIA, mix: true },
  instagram: { name: 'Instagram', text: 2200, needs: 'media', videos: MEDIA, images: MEDIA, mix: true },
  linkedin: { name: 'LinkedIn', text: 3000, needs: 'nothing', videos: 1, images: 9, mix: false },
  tiktok: { name: 'TikTok', text: 2200, needs: 'media', videos: 1, images: MEDIA, mix: false },
  youtube: { name: 'YouTube', text: 5000, needs: 'video', videos: 1, images: 0, mix: false },
  threads: { name: 'Threads', text: 500, needs: 'nothing', videos: 1, images: MEDIA, mix: true },
}

/**
 * How this network composes.
 *
 * A network the table has not met falls back to the platform's own caps — 8192
 * characters and 10 media — because those are the only limits that are certainly
 * true of it. Guessing tighter would refuse a post the network would have taken.
 */
export function rule(provider: string): Rule {
  return (
    RULES[provider] ?? {
      name: provider,
      text: 8192,
      needs: 'nothing',
      videos: MEDIA,
      images: MEDIA,
      mix: true,
    }
  )
}

export type Kind = 'image' | 'video' | 'unknown'

const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi|mpe?g|3gp)(\?|#|$)/i
const IMAGE = /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?)(\?|#|$)/i

/**
 * What a media URL points at.
 *
 * Read off the address, because that is all there is to read: the post carries
 * URLs and nothing fetches them here. An address that names neither is
 * `unknown`, and the composer says so rather than assuming — guessing "image"
 * is how a video ends up refused by a network that would have taken it, and
 * guessing "video" is how a YouTube post goes out with a JPEG.
 */
export function kind(url: string): Kind {
  const path = url.split(/[?#]/)[0] ?? ''
  if (VIDEO.test(path)) return 'video'
  if (IMAGE.test(path)) return 'image'
  return 'unknown'
}

/**
 * What stops this post going to this network, in the person's words. Empty
 * means the network will take it.
 *
 * These are refusals the network itself would make. The composer will not send
 * a post that collects any — not because the platform would refuse it (it
 * stores what it is given) but because the refusal would otherwise arrive as a
 * failed publish hours later, with the draft already gone.
 */
export function check(provider: string, content: string, media: string[]): string[] {
  const it = rule(provider)
  const said: string[] = []
  const videos = media.filter((m) => kind(m) === 'video')
  const images = media.filter((m) => kind(m) === 'image')
  const strange = media.filter((m) => kind(m) === 'unknown')

  if (!content.trim() && media.length === 0) said.push('There is nothing to post.')
  if (content.length > it.text)
    said.push(`${content.length - it.text} characters over ${it.name}'s limit of ${it.text}.`)
  if (media.length > MEDIA) said.push(`${MEDIA} media items at most.`)
  if (it.needs === 'media' && media.length === 0)
    said.push(`${it.name} needs a photo or a video.`)
  if (it.needs === 'video' && videos.length === 0)
    said.push(`${it.name} needs a video — the video is the post.`)
  if (videos.length > it.videos)
    said.push(
      it.videos === 0
        ? `${it.name} does not take video.`
        : `${it.name} takes ${it.videos} video${it.videos === 1 ? '' : 's'}, not ${videos.length}.`,
    )
  if (!it.mix && videos.length > 0 && images.length > 0)
    said.push(`On ${it.name} a video is the whole post — it cannot carry photos as well.`)
  if (images.length > it.images)
    said.push(
      it.images === 0
        ? `${it.name} does not take photos.`
        : `${it.name} takes ${it.images} photo${it.images === 1 ? '' : 's'}, not ${images.length}.`,
    )
  if (strange.length > 0)
    said.push(
      `The address ${strange[0]} does not say whether it is a photo or a video, so ${it.name}'s rules cannot be checked against it.`,
    )
  return said
}
