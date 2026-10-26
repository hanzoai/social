// This organization's developer apps, one pair of keys per network.
//
// THE DEPLOYMENT'S apps are environment variables. These are the org's own,
// pasted here and sealed by PUT /v1/social/credentials. A secret comes back
// only as the fact that it is set. The screen masks the public id too: a
// shoulder-surfed client id is still a client id.
//
// THE ROUTE IS NEW. A deployment that answers 404 or 501 has not shipped it,
// and the rail does not grow a Keys item for a page that cannot save. The
// address still resolves, and says so, for anyone who opens it directly.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { credentialWrite, maskId, maskSecret, type OrgApp } from '~/credentials'
import { useHttp } from '~/client'
import { rule } from '~/network'
import { Act, Failed, Ready, Screen } from '~/page'
import { saveOrgApps, useNetworks, useOrgApps, why } from '~/social'

const field = {
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
} as const

interface Draft {
  id: string
  secret: string
  clear: boolean
}

const empty: Draft = { id: '', secret: '', clear: false }

function AppCard({
  provider,
  app,
  again,
}: {
  provider: string
  app: OrgApp | undefined
  again: () => void
}) {
  const http = useHttp()
  const it = rule(provider)
  const [draft, setDraft] = useState<Draft>(empty)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const storedId = app?.clientId ?? ''
  const secretSet = Boolean(app?.secretSet) && !draft.clear
  const write = credentialWrite({
    provider,
    clientId: storedId,
    nextClientId: draft.id,
    nextSecret: draft.secret,
    clearSecret: draft.clear,
  })

  const save = async () => {
    if (!http || !write || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await saveOrgApps(http, [write])
      setDraft(empty)
      again()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$3" p="$4" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <Text fontSize="$3" fontWeight="500" color="$ink">
        {it.name}
      </Text>
      <YStack gap="$1">
        <Text fontSize="$1" color="$soft">
          Client id
        </Text>
        <Text fontSize="$2" color={storedId ? '$ink' : '$quiet'}>
          {storedId ? maskId(storedId) : 'Not set'}
        </Text>
        <input
          aria-label={`${it.name} client id`}
          value={draft.id}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          placeholder={storedId ? 'Type a new client id to replace it' : 'Client id'}
          style={field}
        />
      </YStack>
      <YStack gap="$1">
        <Text fontSize="$1" color="$soft">
          Client secret
        </Text>
        <Text fontSize="$2" color={secretSet ? '$ink' : '$quiet'}>
          {draft.clear ? 'Will be removed on save' : secretSet ? maskSecret(true) : 'Not set'}
        </Text>
        <XStack gap="$2" items="center">
          <input
            aria-label={`${it.name} client secret`}
            type="password"
            value={draft.secret}
            autoComplete="new-password"
            onChange={(e) => setDraft({ ...draft, secret: e.target.value, clear: false })}
            placeholder={secretSet ? 'Type a new secret to replace it' : 'Client secret'}
            style={field}
          />
          {app?.secretSet ? (
            <Act
              onPress={() => setDraft({ ...draft, secret: '', clear: !draft.clear })}
              disabled={busy}
            >
              {draft.clear ? 'Keep secret' : 'Remove secret'}
            </Act>
          ) : null}
        </XStack>
      </YStack>
      <XStack>
        <Act onPress={() => void save()} disabled={busy || !write}>
          {busy ? 'Saving…' : `Save ${it.name}`}
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

export function Credentials() {
  const http = useHttp()
  const networks = useNetworks(http)
  const apps = useOrgApps(http)
  const byId = new Map((apps.it?.apps ?? []).map((app) => [app.provider, app]))
  const unshipped = Boolean(apps.it?.unshipped)

  return (
    <Ready>
      <Screen
        title="App credentials"
        says="Paste this organization's own developer-app id and secret for a network. The secret is sealed on save and shown here only as a mask. A network left blank keeps the deployment's app."
      >
        {networks.failed ? <Failed what="the networks" why={networks.failed} /> : null}
        {apps.failed ? <Failed what="the app credentials" why={apps.failed} /> : null}
        {!apps.it && !apps.failed ? (
          <Text fontSize="$2" color="$soft">
            Reading app credentials…
          </Text>
        ) : unshipped ? (
          <Text fontSize="$2" color="$soft">
            This deployment does not accept organization app credentials yet.
          </Text>
        ) : apps.it ? (
          <YStack gap="$3">
            {(networks.it ?? []).map((network) => (
              <AppCard
                key={network.provider}
                provider={network.provider}
                app={byId.get(network.provider)}
                again={apps.again}
              />
            ))}
          </YStack>
        ) : null}
      </Screen>
    </Ready>
  )
}
