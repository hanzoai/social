// Time, in the two forms this app shows it.
//
// The platform counts in SECONDS — every timestamp on a post and an account is
// unix seconds — and JavaScript counts in milliseconds. The conversion lives
// here so no screen does it, because a screen that forgets is a screen that
// draws 1970 and a screen that doubles it draws the year 57000.

/** Seconds since the epoch, as the platform counts. */
export const now = (): number => Math.floor(Date.now() / 1000)

const DAY = 86400

/** A moment, written out: "12 Mar 2026, 14:30". Empty for an unset time. */
export function at(seconds: number): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * The distance from now, in the coarsest unit that still says something: "in 3
 * hours", "2 days ago". A scheduled post's usefulness is how soon, not when, and
 * a person reading a queue is comparing rows rather than reading a clock.
 */
export function since(seconds: number): string {
  if (!seconds) return ''
  const gap = seconds - now()
  const ahead = gap > 0
  const size = Math.abs(gap)
  const [count, unit] =
    size < 60
      ? [size, 'second']
      : size < 3600
        ? [Math.round(size / 60), 'minute']
        : size < DAY
          ? [Math.round(size / 3600), 'hour']
          : size < DAY * 30
            ? [Math.round(size / DAY), 'day']
            : [Math.round(size / (DAY * 30)), 'month']
  const word = `${count} ${unit}${count === 1 ? '' : 's'}`
  return ahead ? `in ${word}` : `${word} ago`
}

/** The local calendar day a moment falls on, as "2026-03-12" — the key a
 *  calendar groups by. Local rather than UTC: a person schedules against the
 *  clock on their wall, and grouping by UTC moves an evening post to tomorrow. */
export function day(seconds: number): string {
  const d = new Date(seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The days of one month's grid, Monday first, padded out to whole weeks.
 *
 * Whole weeks because the grid is seven wide and a ragged last row reads as
 * missing days rather than as the month ending. Each entry carries whether it
 * belongs to the month asked for, so the padding can be drawn dimmer than the
 * month itself.
 */
export function grid(year: number, month: number): { key: string; date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-first; this app's week starts Monday, which is the one
  // the rest of the world schedules against.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  const out: { key: string; date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    out.push({ key: day(Math.floor(date.getTime() / 1000)), date, inMonth: date.getMonth() === month })
    // Six rows covers every month; five is enough for most, so the tail is
    // trimmed once the month is behind us and the row is entirely padding.
    if (i >= 34 && i % 7 === 6 && date.getMonth() !== month) {
      const week = out.slice(-7)
      if (week.every((d) => !d.inMonth)) out.length -= 7
      break
    }
  }
  return out
}

/**
 * A moment as the value a `datetime-local` input holds, and back.
 *
 * The control speaks LOCAL wall-clock with no zone, so the two conversions are
 * asymmetric and both belong here: to the control, subtract the browser's offset
 * so the ISO string reads as the local time; from the control, `new Date` on a
 * zone-less string is already local.
 */
export function toField(seconds: number): string {
  if (!seconds) return ''
  const d = new Date(seconds * 1000)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function fromField(value: string): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000)
}
