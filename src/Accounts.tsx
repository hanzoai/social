// Every network, with the two separate things it needs before a post can go out.
//
// THE CONSENT is the org's credential for the network — the OAuth the person
// gives once, sealed into KMS. `GET /v1/provider` reports whether this org
// has it and whether this deployment could even ask for it;
// `POST /v1/provider/:provider/connect` starts it and answers the network's
// own consent URL.
//
// THE TARGETS are the handles a publish fans out to — `/v1/social/accounts`.
//
// They are separately true and the screen keeps them apart, because a network
// with consent and no target publishes nothing, a network with a target and no
// consent publishes nothing, and a screen that merged them could not say which
// was missing.
//
// NO CREDENTIAL IS ON THIS SCREEN. The consent happens at the network's own
// site; what comes back here is an account label and the scopes granted. The
// token itself never leaves KMS.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Link } from 'react-router'

import { cardCopy, catalogState } from '~/catalog'
import { Act, Ready, Failed, Screen } from '~/page'
import { Mark, accountTone } from '~/status'
import { rule } from '~/network'
import { since } from '~/time'
import { useHttp } from '~/client'
import {
  addAccount,
  connect,
  disconnect,
  dropAccount,
  useAccounts,
  useConnections,
  useNetworks,
  why,
  type Account,
  type Network,
  type Standing,
} from '~/social'

/** The handles on one network, and the way to add another. */
function Targets({
  provider,
  rows,
  again,
}: {
  provider: string
  rows: Account[]
  again: () => void
}) {
  const http = useHttp()
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const run = async (go: () => Promise<unknown>) => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await go()
      setHandle('')
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$2">
      {rows.map((row) => (
        <XStack key={row.id} items="center" gap="$3">
          <Text fontSize="$2" color="$ink" flex={1} minW={0} numberOfLines={1}>
            {row.handle}
          </Text>
          <Mark of={accountTone(row.status)} says={row.status} />
          <Text fontSize="$1" color="$quiet">
            {since(row.createdAt)}
          </Text>
          <Act onPress={() => void run(() => dropAccount(http!, row.id))} disabled={busy}>
            Remove
          </Act>
        </XStack>
      ))}
      <XStack gap="$2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' &&
            handle.trim() &&
            void run(() => addAccount(http!, { provider, handle: handle.trim() }))
          }
          placeholder="The handle on this network"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            outline: 'none',
            color: 'inherit',
            font: 'inherit',
            fontSize: 13,
          }}
        />
        <Act
          onPress={() => void run(() => addAccount(http!, { provider, handle: handle.trim() }))}
          disabled={busy || !handle.trim()}
        >
          {busy ? 'Saving…' : 'Add'}
        </Act>
      </XStack>
      {failed ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {failed}
        </Text>
      ) : null}
    </YStack>
  )
}

/** One network: what this deployment can do, what this org has consented to,
 *  and the handles a publish would reach. */
function One({
  network,
  standing,
  catalog,
  rows,
  again,
}: {
  network: Network
  standing: Standing | undefined
  /** loading, failed, or answered — never inferred from a missing connection. */
  catalog: 'loading' | 'failed' | 'ready'
  rows: Account[]
  again: () => void
}) {
  const http = useHttp()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const it = rule(network.provider)
  // A connection from a read that has not answered is not a connection. The
  // card would otherwise describe a loading catalog as a network the registry
  // does not contain.
  const connection = catalog === 'ready' ? standing?.connection : undefined
  const on = Boolean(connection?.connected)
  const copy = cardCopy({
    name: it.name,
    provider: network.provider,
    catalog,
    connection,
    missingCredentials: network.missingCredentials,
    detail: standing?.failed,
  })

  const start = async () => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    try {
      const { authorizeUrl } = await connect(http, network.provider)
      // The network's own consent screen. A full navigation rather than a popup:
      // several of these refuse to render in a frame or a window opened by
      // script, and the return address is this app's own origin.
      if (authorizeUrl) window.location.assign(authorizeUrl)
      else setFailed('The platform did not answer a consent address for this network.')
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await disconnect(http, network.provider)
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$3" p="$4" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3">
        <Text fontSize="$3" fontWeight="500" color="$ink" flex={1}>
          {it.name}
        </Text>
        <Mark of={on ? 'up' : 'quiet'} says={on ? 'connected' : 'not connected'} />
      </XStack>

      <YStack gap="$1">
        {copy.caption ? (
          <Text fontSize="$1" color="$soft">
            {copy.caption}
          </Text>
        ) : null}
        {on && connection?.connection ? (
          <Text fontSize="$1" color="$quiet">
            {connection.connection.account || 'account connected'}
            {connection.connection.scopes.length
              ? ` · ${connection.connection.scopes.join(', ')}`
              : ''}
          </Text>
        ) : null}
      </YStack>

      <XStack gap="$2" items="center" flexWrap="wrap">
        {on ? (
          <Act onPress={() => void stop()} disabled={busy}>
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </Act>
        ) : connection?.available ? (
          <Act onPress={() => void start()} disabled={busy} loud>
            {busy ? 'Opening…' : `Connect ${it.name}`}
          </Act>
        ) : copy.needs ? (
          <Text fontSize="$1" color="$quiet">
            {copy.needs}
          </Text>
        ) : null}
      </XStack>

      {/*
        The publish edge reads a second set of credentials — the social plane's
        own — and names the environment variables it is missing. Only the NAMES;
        a value never crosses this wire. It is for whoever runs the deployment,
        so it reads quiet rather than loud: the person on this screen cannot set
        an environment variable. Omitted when `needs` already named this same
        set, which is the case once the two planes agree.
      */}
      {copy.publishing ? (
        <Text fontSize="$1" color="$quiet">
          {copy.publishing}
        </Text>
      ) : null}

      <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$borderColor">
        <Text fontSize="$2" color="$soft">
          Where posts go — {rows.length} handle{rows.length === 1 ? '' : 's'}
        </Text>
        <Targets provider={network.provider} rows={rows} again={again} />
      </YStack>

      {failed ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {failed}
        </Text>
      ) : null}
    </YStack>
  )
}

export function Accounts() {
  const http = useHttp()
  const networks = useNetworks(http)
  const accounts = useAccounts(http)
  const all = networks.it ?? []
  // The social list is still out. Holding the catalog read keeps "no answer
  // yet" distinct from "the registry came back without these ids".
  const connections = useConnections(
    http,
    all.map((n) => n.provider),
    networks.it === null && !networks.failed,
  )

  const again = () => {
    accounts.again()
    connections.again()
  }

  return (
    <Ready>
      <Screen
        title="Connect"
        says="Connect a network, then say which handles a post goes to. This is the first step before you write or schedule."
        beside={
          <Link to="/compose" style={{ textDecoration: 'none' }}>
            <XStack px="$3" py="$2" rounded="$3" borderWidth={1} borderColor="$ink" bg="$ink">
              <Text fontSize="$2" color="$background" fontWeight="500">
                Post
              </Text>
            </XStack>
          </Link>
        }
      >
        {networks.failed ? <Failed what="the networks" why={networks.failed} /> : null}
        {accounts.failed ? <Failed what="the accounts" why={accounts.failed} /> : null}
        {connections.failed ? <Failed what="the connections" why={connections.failed} /> : null}

        <YStack gap="$3">
          {all.map((network) => {
            const standing = (connections.it ?? []).find((c) => c.id === network.provider)
            return (
              <One
                key={network.provider}
                network={network}
                standing={standing}
                catalog={catalogState(connections.it !== null, Boolean(connections.failed), standing)}
                rows={(accounts.it ?? []).filter((a) => a.provider === network.provider)}
                again={again}
              />
            )
          })}
        </YStack>
      </Screen>
    </Ready>
  )
}
