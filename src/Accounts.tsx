// Every network, and the accounts an organization has on it — one list, one place.
//
// A network is connected one of two ways (connect.ts): a consent at the
// network's own site, which opens in a window beside this screen, or a form
// for a credential the person holds — a Bluesky app password, a Mastodon
// token, a Telegram bot, a Discord webhook — which the network verifies before
// anything is kept. Either way the account lands in the same list under the
// network's name, and Remove ends that one account and leaves the others.
//
// A network whose developer app the deployment does not hold cannot be
// consented to, and says so: it needs the owner's credentials. The
// organization can bring its own app on Keys.
//
// NO CREDENTIAL IS READ BACK ON THIS SCREEN. A form's fields are sent once and
// sealed; what comes back is an account name and the scopes granted. The token
// itself never leaves KMS.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Link } from 'react-router'

import { audiencesFor, isAudience, whereLine, type Audience } from '~/audience'
import { cardCopy, catalogState, takesApp } from '~/catalog'
import { connectLabel, formOf, returnSays, standing as stand, way, type Return } from '~/connect'
import { openConsent, sendConsent, useReturn } from '~/handoff'
import { Act, Ready, Failed, Screen } from '~/page'
import { Mark, accountTone } from '~/status'
import { rule } from '~/network'
import { since } from '~/time'
import { useHttp } from '~/client'
import {
  connect,
  disconnect,
  dropAccount,
  forgetAudience,
  saveAudience,
  useAccounts,
  useAudiences,
  useConnections,
  useNetworks,
  why,
  type Account,
  type ConnectorField,
  type Network,
  type Standing,
} from '~/social'

const field = {
  minWidth: 0,
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 10px',
  outline: 'none',
  color: 'inherit',
  font: 'inherit',
  fontSize: 13,
} as const

/** The accounts on one network. Several are normal: a personal profile and the
 *  organization's own. */
function Rows({
  provider,
  rows,
  audiences,
  again,
}: {
  provider: string
  rows: Account[]
  audiences: Record<string, Audience>
  again: () => void
}) {
  const http = useHttp()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const choices = audiencesFor(provider)

  const run = async (go: () => Promise<unknown>) => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await go()
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  if (rows.length === 0) {
    return (
      <Text fontSize="$1" color="$quiet">
        No account connected yet.
      </Text>
    )
  }

  return (
    <YStack gap="$2">
      {rows.map((row) => {
        const kind = audiences[row.id]
        return (
          <XStack key={row.id} items="center" gap="$3" flexWrap="wrap">
            <Text fontSize="$2" color="$ink" flex={1} minW={140} numberOfLines={1}>
              {row.handle}
            </Text>
            <select
              aria-label={`Kind of ${row.handle || 'this account'}`}
              value={kind ?? ''}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value
                if (!http || !isAudience(next)) return
                void run(() => saveAudience(http, row.id, next))
              }}
              style={field}
            >
              <option value="">Which account</option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
            <Mark of={accountTone(row.status)} says={row.status} />
            <Text fontSize="$1" color="$quiet">
              {since(row.createdAt)}
            </Text>
            <Act
              onPress={() =>
                void run(async () => {
                  // An account with a consent behind it is ended at the platform,
                  // which also takes it off this list. One typed in by hand has no
                  // consent, so only its row goes.
                  if (row.externalId) await disconnect(http!, provider, row.externalId)
                  else await dropAccount(http!, row.id)
                  await forgetAudience(http!, row.id)
                })
              }
              disabled={busy}
            >
              Remove
            </Act>
          </XStack>
        )
      })}
      {failed ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {failed}
        </Text>
      ) : null}
    </YStack>
  )
}

/** The form of a connector that takes a credential. */
function Credential({
  name,
  fields,
  busy,
  onSubmit,
}: {
  name: string
  fields: ConnectorField[]
  busy: boolean
  onSubmit: (body: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const form = formOf(fields, values)
  const ready = form.missing.length === 0

  return (
    <YStack gap="$3">
      {fields.map((f) => (
        <YStack key={f.name} gap="$1">
          <Text fontSize="$1" color="$soft">
            {f.label}
            {f.required ? '' : ' (optional)'}
          </Text>
          <input
            aria-label={`${name} ${f.label}`}
            type={f.secret ? 'password' : 'text'}
            value={values[f.name] ?? ''}
            autoComplete={f.secret ? 'new-password' : 'off'}
            spellCheck={false}
            autoCapitalize="off"
            placeholder={f.default ?? ''}
            onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready && !busy) onSubmit(form.body)
            }}
            style={{ ...field, width: '100%' }}
          />
          {f.help ? (
            <Text fontSize="$1" color="$quiet">
              {f.help}
            </Text>
          ) : null}
        </YStack>
      ))}
      <XStack>
        <Act onPress={() => onSubmit(form.body)} disabled={busy || !ready} loud>
          {busy ? 'Checking…' : `Connect ${name}`}
        </Act>
      </XStack>
    </YStack>
  )
}

/** One network: what it is, what this deployment can do, the accounts on it,
 *  and the way to add another. */
function One({
  network,
  row,
  catalog,
  rows,
  audiences,
  again,
}: {
  network: Network
  row: Standing | undefined
  /** loading, failed, or answered — never inferred from a missing connection. */
  catalog: 'loading' | 'failed' | 'ready'
  rows: Account[]
  audiences: Record<string, Audience>
  again: () => void
}) {
  const http = useHttp()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const it = rule(network.provider)
  // A connection from a read that has not answered is not a connection. The
  // card would otherwise describe a loading catalog as a network the registry
  // does not contain.
  const connection = catalog === 'ready' ? row?.connection : undefined
  const how = way(connection)
  const count = Math.max(rows.length, connection?.accounts?.length ?? 0)
  const mark = stand(how, count)
  const copy = cardCopy({
    name: it.name,
    provider: network.provider,
    catalog,
    connection,
    missingCredentials: network.missingCredentials,
    detail: row?.failed,
  })

  const consent = async () => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    // The window opens in the click, before the request: one opened after an
    // await is one the browser takes for a popup nobody asked for.
    const win = openConsent()
    try {
      const { authorizeUrl } = await connect(http, network.provider, {
        back: `${window.location.origin}/accounts`,
      })
      if (!authorizeUrl) {
        win?.close()
        setFailed('The platform did not answer a consent address for this network.')
        return
      }
      sendConsent(win, authorizeUrl)
    } catch (e) {
      win?.close()
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = async (fields: Record<string, string>) => {
    if (!http || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await connect(http, network.provider, { fields })
      setAdding(false)
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$3" p="$4" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3" flexWrap="wrap">
        <Text fontSize="$3" fontWeight="500" color="$ink" flex={1} minW={120}>
          {it.name}
        </Text>
        <Mark of={mark.tone} says={mark.says} />
      </XStack>

      {copy.caption ? (
        <Text fontSize="$1" color="$soft">
          {copy.caption}
        </Text>
      ) : null}

      <Rows provider={network.provider} rows={rows} audiences={audiences} again={again} />

      <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$borderColor">
        {how === 'consent' ? (
          <XStack gap="$2" items="center" flexWrap="wrap">
            <Act onPress={() => void consent()} disabled={busy} loud={count === 0}>
              {busy ? 'Opening…' : connectLabel(it.name, count)}
            </Act>
          </XStack>
        ) : null}

        {how === 'form' && connection?.fields ? (
          count > 0 && !adding ? (
            <XStack>
              <Act onPress={() => setAdding(true)}>{connectLabel(it.name, count)}</Act>
            </XStack>
          ) : (
            <Credential name={it.name} fields={connection.fields} busy={busy} onSubmit={(b) => void submit(b)} />
          )
        ) : null}

        {how === 'owner' && copy.needs ? (
          <YStack gap="$1">
            <Text fontSize="$1" color="$quiet">
              {copy.needs}
            </Text>
            {takesApp(network.provider) ? (
              <Link to="/settings" style={{ textDecoration: 'none' }}>
                <Text fontSize="$1" color="$soft">
                  Or add this organization's own {it.name} app on Keys.
                </Text>
              </Link>
            ) : null}
          </YStack>
        ) : null}

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

        {failed ? (
          <Text fontSize="$1" color="$ink" fontWeight="500">
            {failed}
          </Text>
        ) : null}
      </YStack>

      {rows.length > 0 ? (
        <Text fontSize="$1" color="$quiet">
          {whereLine(network.provider, rows, audiences)}
        </Text>
      ) : null}
    </YStack>
  )
}

export function Accounts() {
  const http = useHttp()
  const networks = useNetworks(http)
  const accounts = useAccounts(http)
  const audiences = useAudiences(http)
  const all = networks.it ?? []
  // The social list is still out. Holding the catalog read keeps "no answer
  // yet" distinct from "the registry came back without these ids".
  const connections = useConnections(
    http,
    all.map((n) => n.provider),
    networks.it === null && !networks.failed,
  )
  const [notice, setNotice] = useState<string | null>(null)

  const again = () => {
    accounts.again()
    connections.again()
    audiences.again()
  }

  // A consent came back: say how it went, and read everything again.
  useReturn((back: Return) => {
    setNotice(returnSays(back, (id) => rule(id).name))
    again()
  })

  return (
    <Ready>
      <Screen
        title="Connect"
        says="Connect a network, then say which accounts a post goes to. An organization can list several on one network — a personal profile and a company one."
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
        {notice ? (
          <XStack
            items="center"
            gap="$3"
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            role="status"
          >
            <Text fontSize="$2" color="$ink" flex={1}>
              {notice}
            </Text>
            <Act onPress={() => setNotice(null)}>Dismiss</Act>
          </XStack>
        ) : null}
        {networks.failed ? <Failed what="the networks" why={networks.failed} /> : null}
        {accounts.failed ? <Failed what="the accounts" why={accounts.failed} /> : null}
        {audiences.failed ? <Failed what="which accounts are personal or company" why={audiences.failed} /> : null}
        {connections.failed ? <Failed what="the connections" why={connections.failed} /> : null}

        <YStack gap="$3">
          {all.map((network) => {
            const row = (connections.it ?? []).find((c) => c.id === network.provider)
            return (
              <One
                key={network.provider}
                network={network}
                row={row}
                catalog={catalogState(connections.it !== null, Boolean(connections.failed), row)}
                rows={(accounts.it ?? []).filter((a) => a.provider === network.provider)}
                audiences={audiences.it ?? {}}
                again={again}
              />
            )
          })}
        </YStack>

        <Text fontSize="$1" color="$quiet">
          Hacker News has no posting API, so it is not offered here.
        </Text>
      </Screen>
    </Ready>
  )
}
