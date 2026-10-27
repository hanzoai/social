// The window a network's consent happens in, and how its result gets back.
//
// A consent is the network's own page, and several of them refuse to draw in a
// frame. A full-page redirect works and loses the screen the person was on, so
// the consent opens in a window beside it and the result is handed back, the
// way Sign in already does (enter.ts). A browser that refuses the window falls
// back to the redirect, which is the only alternative there is.
//
// THE RESULT COMES BACK BY A BROADCAST, not by `window.opener`. Facebook,
// Google and X send a cross-origin-opener policy that cuts the link between the
// window and the page that opened it, and a link that was cut cannot be read
// back. The window returns to this app's own origin, so the two share a
// channel whatever happened in between.

import { useEffect } from 'react'

import { readReturn, withoutReturn, type Return } from '~/connect'

/** The window's name, so a second Connect reuses it instead of stacking more. */
export const CONSENT = 'hanzo-social-connect'

const CHANNEL = 'hanzo-social-connect'
/** How long a window that came back waits for the page that sent it to answer. */
const ANSWER = 700

/**
 * Open the window the consent will happen in. It must be called in the click
 * itself, before anything is awaited: a window opened after a request is a
 * window the browser takes for one nobody asked for. Null means it refused.
 */
export function openConsent(): Window | null {
  return window.open('', CONSENT, 'popup,width=640,height=780')
}

/** Send the window to the network's consent, or this page if there was no window. */
export function sendConsent(win: Window | null, address: string): void {
  if (win && !win.closed) win.location.href = address
  else window.location.assign(address)
}

/** The page that opened the window answers a return so the window may close. */
function hear(on: (back: Return) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent<{ kind?: string; back?: Return }>) => {
    if (event.data?.kind !== 'return' || !event.data.back) return
    on(event.data.back)
    channel.postMessage({ kind: 'answered' })
  }
  return () => channel.close()
}

/** Hand a return to the page that opened this window. True if one took it. */
function hand(back: Return): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL)
    const give = setTimeout(() => {
      channel.close()
      resolve(false)
    }, ANSWER)
    channel.onmessage = (event: MessageEvent<{ kind?: string }>) => {
      if (event.data?.kind !== 'answered') return
      clearTimeout(give)
      channel.close()
      resolve(true)
    }
    channel.postMessage({ kind: 'return', back })
  })
}

/**
 * Report a consent's result, wherever it arrives.
 *
 * In the page that started it, the result comes over the channel. In the window
 * the consent returned to, the address carries it: the window hands it over and
 * closes itself. A page that nobody answers — the person was sent here by a
 * redirect, or opened the address themselves — reports it and takes it off the
 * address so a reload does not report it again.
 */
export function useReturn(on: (back: Return) => void): void {
  useEffect(() => {
    const stop = hear(on)
    const back = readReturn(window.location.search)
    if (back) {
      void hand(back).then((taken) => {
        // A window the page opened closes. One that will not close, or that no one
        // opened, shows the result itself.
        if (taken) window.close()
        on(back)
        window.history.replaceState(null, '', window.location.pathname + withoutReturn(window.location.search))
      })
    }
    return stop
    // `on` is the caller's closure; the channel is opened once for the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
