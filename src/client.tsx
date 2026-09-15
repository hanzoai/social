// The platform client, and the tenant it speaks for.
//
// ONE CLIENT, mounted once, so no screen carries a second. A second client is a
// second credential and a second organization, and the two disagree the moment
// either changes.
//
// SIGNED OUT THERE IS NO CLIENT. Every /v1/social route requires a validated
// principal and answers 403 without one, so an anonymous client would exist only
// to be refused — every screen would fill with a failure that is really just
// "nobody is signed in". `useHttp()` answers null instead and each screen says
// so once, in its own words.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { AiProvider } from '@hanzo/ai/react'
import { createAiClient, type HttpClient } from '@hanzo/ai'
import { api } from '~/api'
import { bearer, hasSession, org, orgs, work } from '~/token'

/** The tenant this browser works in, and the way to move to another. */
export interface Tenant {
  /** The organization every read and write is scoped to, or null when the
   *  account belongs to several and has not picked. */
  org: string | null
  /** Every organization the token carries. One is not a choice. */
  orgs: string[]
  choose: (org: string) => void
}

const Who = createContext<Tenant>({ org: null, orgs: [], choose: () => {} })
const Transport = createContext<HttpClient | null>(null)

/** The transport every read and write on this surface goes through, or null
 *  when nobody is signed in. */
export function useHttp(): HttpClient | null {
  return useContext(Transport)
}

/** The tenant, and the switch. */
export function useTenant(): Tenant {
  return useContext(Who)
}

export function Client({ children }: { children: ReactNode }) {
  const { sdk, isAuthenticated } = useIam()
  // The selection is REACT STATE as well as a stored key. Storage events fire
  // in other tabs only, so a switch made here would move the key and leave this
  // tab's client scoped to the organization it was built with.
  const [picked, setPicked] = useState<string | null>(() => org())
  const mine = useMemo(() => orgs(), [isAuthenticated, picked])

  const account = Boolean((isAuthenticated || hasSession()) && sdk)

  const client = useMemo(
    () =>
      account && sdk
        ? createAiClient({
            baseUrl: api(),
            headers: picked ? { 'X-Org-Id': picked } : {},
            auth: {
              ...sdk,
              getValidAccessToken: async () => (await sdk.getValidAccessToken?.()) || bearer(),
            },
          })
        : null,
    [account, sdk, picked],
  )

  const tenant = useMemo<Tenant>(
    () => ({
      org: picked,
      orgs: mine,
      choose: (pick) => {
        work(pick)
        setPicked(pick)
      },
    }),
    [picked, mine],
  )

  // AiProvider as well as the transport context: @hanzo/ui's shared components
  // read the client from it, and a component that finds none renders its own
  // signed-out state rather than throwing.
  return (
    <Who.Provider value={tenant}>
      <Transport.Provider value={client ? client.http : null}>
        {client ? <AiProvider client={client}>{children}</AiProvider> : children}
      </Transport.Provider>
    </Who.Provider>
  )
}
