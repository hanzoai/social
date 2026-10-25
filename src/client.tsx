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

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useIam, useOrganizations } from '@hanzo/iam/react'
import { AiProvider } from '@hanzo/ai/react'
import { createAiClient, type HttpClient } from '@hanzo/ai'
import { api } from '~/api'
import { bearer, hasSession } from '~/token'

/** One organization the switcher can name. `name` is the id the gateway expects. */
export interface TenantOrg {
  name: string
  displayName?: string
}

/** The tenant this browser works in, and the way to move to another. */
export interface Tenant {
  /** The organization every read and write is scoped to. The shared IAM hook
   *  picks the stored selection, or the home organization when there is no
   *  stored one, so a signed-in surface is never silently unscoped. */
  org: string | null
  /** Every organization the session carries, in the order the IAM client reads them. */
  orgs: TenantOrg[]
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
  // THE SAME HOOK THE OTHER HANZO SURFACES USE. A local parser of the `orgs`
  // claim dropped the owner fallback the IAM client keeps, so a session whose
  // memberships live on that fallback had no switcher and sent no `X-Org-Id`.
  // `useOrganizations` also writes `hanzo_iam_current_org`, the key every other
  // surface reads, and its state is what this tab re-renders on — storage
  // events fire in other tabs only.
  const membership = useOrganizations()

  const account = Boolean((isAuthenticated || hasSession()) && sdk)
  const picked = account ? membership.currentOrgId : null
  const mine = account ? membership.organizations : []

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
      orgs: mine.map((one) => ({
        name: one.name,
        displayName: one.displayName || one.name,
      })),
      choose: membership.switchOrg,
    }),
    [picked, mine, membership.switchOrg],
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
