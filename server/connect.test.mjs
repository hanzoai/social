import assert from 'node:assert/strict'
import test from 'node:test'

import {
  connectLabel,
  formOf,
  readReturn,
  returnSays,
  standing,
  way,
  withoutReturn,
} from '../src/connect.ts'
import { CONNECT_CREDENTIALS, takesApp } from '../src/catalog.ts'

const form = [
  { name: 'identifier', label: 'Handle', secret: false, required: true },
  { name: 'password', label: 'App password', secret: true, required: true },
  { name: 'server', label: 'Server', secret: false, required: false, default: 'https://bsky.social' },
]

test('a network is connected by consent, by a form, or needs the owner', () => {
  assert.equal(way({ available: true, kind: 'oauth' }), 'consent')
  assert.equal(way({ available: false, kind: 'oauth' }), 'owner')
  assert.equal(way({ available: true, kind: 'credential', fields: form }), 'form')
  // A credential connector with no fields has nothing to type: it cannot be a form.
  assert.equal(way({ available: true, kind: 'credential', fields: [] }), 'consent')
  assert.equal(way(undefined), 'owner')
})

test('a card says connected, connect, or needs owner credentials', () => {
  assert.deepEqual(standing('consent', 0), { tone: 'quiet', says: 'not connected' })
  assert.deepEqual(standing('form', 0), { tone: 'quiet', says: 'not connected' })
  assert.deepEqual(standing('owner', 0), { tone: 'quiet', says: 'needs owner credentials' })
  assert.deepEqual(standing('consent', 1), { tone: 'up', says: 'connected' })
  assert.deepEqual(standing('form', 3), { tone: 'up', says: '3 connected' })
  // Accounts that exist are connected, whatever the deployment holds today.
  assert.deepEqual(standing('owner', 2), { tone: 'up', says: '2 connected' })
})

test('the button offers another account once there is one', () => {
  assert.equal(connectLabel('Bluesky', 0), 'Connect Bluesky')
  assert.equal(connectLabel('LinkedIn', 2), 'Connect another LinkedIn account')
})

test('a form sends what was typed, trimmed, and names what is still missing', () => {
  assert.deepEqual(formOf(form, { identifier: ' you.bsky.social ', password: 'an-app-password', server: '' }), {
    body: { identifier: 'you.bsky.social', password: 'an-app-password' },
    missing: [],
  })
  assert.deepEqual(formOf(form, { identifier: 'you', server: 'pds.example' }), {
    body: { identifier: 'you', server: 'pds.example' },
    missing: ['App password'],
  })
  assert.deepEqual(formOf(form, {}).missing, ['Handle', 'App password'])
  // A value for a field the form does not have is not sent.
  assert.equal('stray' in formOf(form, { stray: 'x' }).body, false)
})

test('a consent that came back is read off the address', () => {
  assert.deepEqual(readReturn('?connected=bluesky&account=%40acme'), { connected: 'bluesky', account: '@acme' })
  assert.deepEqual(readReturn('?error=reddit&reason=authorization+denied'), { error: 'reddit', reason: 'authorization denied' })
  assert.equal(readReturn(''), null)
  assert.equal(readReturn('?at=2026-10-27T10:00'), null)
})

test('a return is reported in a sentence', () => {
  const name = (id) => ({ bluesky: 'Bluesky', reddit: 'Reddit' })[id] ?? id
  assert.equal(returnSays({ connected: 'bluesky', account: '@acme' }, name), 'Connected Bluesky as @acme.')
  assert.equal(returnSays({ connected: 'bluesky' }, name), 'Connected Bluesky.')
  assert.equal(returnSays({ error: 'reddit', reason: 'authorization denied' }, name), 'Could not connect Reddit: authorization denied.')
  assert.equal(returnSays({ error: 'reddit' }, name), 'Could not connect Reddit.')
})

test('the return comes off the address and nothing else does', () => {
  assert.equal(withoutReturn('?connected=x&account=y'), '')
  assert.equal(withoutReturn('?connected=x&at=2026-10-27T10%3A00&reason=z'), '?at=2026-10-27T10%3A00')
  assert.equal(withoutReturn(''), '')
})

test('the networks that take a developer app are the ones Keys offers', () => {
  for (const id of ['x', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads', 'pinterest', 'reddit']) {
    assert.equal(takesApp(id), true, id)
    assert.ok(CONNECT_CREDENTIALS[id].length >= 2, id)
  }
  // These take the organization's own credential and need no app from anyone.
  for (const id of ['bluesky', 'mastodon', 'telegram-bot', 'discord-webhook']) assert.equal(takesApp(id), false, id)
})
