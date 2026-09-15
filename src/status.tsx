// How a state is drawn on a register that has no hues.
//
// This palette is monochrome. Nine screens each mapping a state to a colour of
// its own — green for published, amber for scheduled, red for failed — resolve
// to one grey here, and four hues rendering as one value is an indicator that
// says nothing. So two things carry state, and both are things the ramp can
// express.
//
// LUMINANCE CARRIES DEGREE. Settled is brightest, in-motion is the middle, at
// rest is dimmest. That is the order a person scans a list in, and every one of
// these indicators sits beside the state's own name — so the shade reinforces a
// word rather than replacing one.
//
// INVERSION CARRIES ATTENTION, AND IT IS SPENT ONCE. `act` is a state a person
// has something to do about, and it takes the loudest thing a monochrome palette
// has: the top of the ramp as a fill, with the ground as the ink on it. That is
// why a network this deployment holds no credentials for reads `quiet` and not
// `act` — the missing item is a deployment's environment variable, which the
// person reading the screen cannot supply. Inverting all seven networks would
// spend the one loud thing on a row nobody can act on, and then a failed post
// has nothing left to be louder than.

import { Text, XStack, YStack } from '@hanzo/ui'
import type { ReactNode } from 'react'

export type Tone = 'up' | 'moving' | 'quiet' | 'act'

/**
 * The four steps, and the three shapes each takes: `ink` for text, `panel` for
 * a filled block with a border, `dot` for the small round one.
 *
 * `as const` and no annotation, because gui types a colour prop as the union of
 * the theme's OWN token names rather than as a string — so the literals here are
 * checked against the theme at compile time, and a token that is not in it is a
 * type error rather than a colour that silently resolves to nothing.
 */
export const step = {
  /** Settled, and what you wanted. Published, connected, ready. */
  up: {
    ink: '$ink',
    panel: { bg: '$raised', borderColor: '$borderColor', color: '$ink' },
    dot: { bg: '$ink', borderColor: '$ink' },
  },
  /** On its way somewhere. Scheduled, publishing. */
  moving: {
    ink: '$soft',
    panel: { bg: '$panel', borderColor: '$borderColor', color: '$soft' },
    dot: { bg: '$soft', borderColor: '$soft' },
  },
  /** Not going out, and nothing is wrong with that. Draft, disconnected. */
  quiet: {
    ink: '$quiet',
    panel: { bg: 'transparent', borderColor: '$borderColor', color: '$quiet' },
    dot: { bg: 'transparent', borderColor: '$quiet' },
  },
  /**
   * Needs a person. Failed, errored.
   *
   * The inversion: the top of the ramp as the fill and the ground as the ink on
   * it. Inline text has no fill to invert, so `ink` is the brightest step plus
   * weight — which is the honest version of what a red that renders as grey was
   * doing.
   */
  act: {
    ink: '$ink',
    panel: { bg: '$ink', borderColor: '$ink', color: '$background' },
    dot: { bg: '$ink', borderColor: '$ink' },
  },
} as const

/** A post's state, as a step. The transient publishing claim is in motion; a
 *  draft is at rest and fine; a failure is the one thing here a person can act on. */
export function tone(status: string): Tone {
  if (status === 'published') return 'up'
  if (status === 'scheduled' || status === 'publishing') return 'moving'
  if (status === 'failed' || status === 'error') return 'act'
  return 'quiet'
}

/** An account's state, as a step. A connected account is a publish target; a
 *  disconnected one is simply not one; an errored one wants attention. */
export function accountTone(status: string): Tone {
  if (status === 'connected') return 'up'
  if (status === 'error') return 'act'
  return 'quiet'
}

/** The state, drawn: the dot and the word it reinforces. */
export function Mark({ of, says }: { of: Tone; says: string }) {
  const it = step[of]
  return (
    <XStack items="center" gap="$2">
      <YStack
        width={6}
        height={6}
        rounded={999}
        bg={it.dot.bg}
        borderWidth={1}
        borderColor={it.dot.borderColor}
      />
      <Text fontSize="$1" color={it.ink} fontWeight={of === 'act' ? '500' : '400'}>
        {says}
      </Text>
    </XStack>
  )
}

/** A block that wants reading before the rest of the screen. Spent on the one
 *  state a person has something to do about. */
export function Callout({ of, children }: { of: Tone; children: ReactNode }) {
  const it = step[of]
  return (
    <YStack
      gap="$1"
      p="$3"
      rounded="$3"
      bg={it.panel.bg}
      borderWidth={1}
      borderColor={it.panel.borderColor}
    >
      {children}
    </YStack>
  )
}
