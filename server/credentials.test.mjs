import assert from 'node:assert/strict'
import test from 'node:test'

import {
  credentialWrite,
  credentialsLive,
  credentialsUnshipped,
  maskId,
  maskSecret,
  parseCredentials,
} from '../src/credentials.ts'

test('a credential catalog drops secrets and accepts either envelope', () => {
  assert.deepEqual(
    parseCredentials({
      apps: [
        { provider: 'x', clientId: 'pub-1234', secretSet: true, clientSecret: 'nope' },
        { provider: ' ', clientId: 'skip' },
        { provider: 'facebook', secretSet: false },
      ],
    }),
    [
      { provider: 'x', clientId: 'pub-1234', secretSet: true },
      { provider: 'facebook', clientId: '', secretSet: false },
    ],
  )
  assert.deepEqual(parseCredentials({ data: [{ provider: 'tiktok', clientId: 'tt' }] }), [
    { provider: 'tiktok', clientId: 'tt', secretSet: false },
  ])
  assert.deepEqual(parseCredentials(null), [])
  assert.equal(JSON.stringify(parseCredentials({ apps: [{ provider: 'x', clientSecret: 'leak' }] })).includes('leak'), false)
})

test('a write sends a secret only when one was typed or cleared, and never a mask', () => {
  const base = { provider: 'x', clientId: 'pub-1234', nextClientId: '', nextSecret: '', clearSecret: false }
  assert.equal(credentialWrite(base), null)
  assert.deepEqual(credentialWrite({ ...base, nextSecret: '  s3cret  ' }), {
    provider: 'x',
    clientId: 'pub-1234',
    clientSecret: 's3cret',
  })
  assert.deepEqual(credentialWrite({ ...base, clearSecret: true }), {
    provider: 'x',
    clientId: 'pub-1234',
    clientSecret: '',
  })
  assert.deepEqual(credentialWrite({ ...base, nextClientId: 'pub-9999' }), {
    provider: 'x',
    clientId: 'pub-9999',
  })
  const replaced = credentialWrite({ ...base, nextClientId: 'pub-9999', nextSecret: 'new' })
  assert.equal(replaced.clientSecret, 'new')
  assert.equal(Object.hasOwn(replaced, 'clientSecret'), true)
  assert.equal(JSON.stringify(replaced).includes('••••'), false)
})

test('ids and secrets are masked, and a short id is hidden whole', () => {
  assert.equal(maskId(''), '')
  assert.equal(maskId('ab'), '••••')
  assert.equal(maskId('pub-1234'), '••••1234')
  assert.equal(maskSecret(false), '')
  assert.equal(maskSecret(true), '••••••••')
  assert.equal(maskSecret(true).includes('value'), false)
})

test('Keys stays off the rail until the route is known to exist', () => {
  assert.equal(credentialsUnshipped({ status: 404 }), true)
  assert.equal(credentialsUnshipped({ status: 501 }), true)
  assert.equal(credentialsUnshipped({ status: 403 }), false)
  assert.equal(credentialsUnshipped({ status: 500 }), false)
  assert.equal(credentialsUnshipped(new Error('down')), false)

  assert.equal(credentialsLive(null, false), false)
  assert.equal(credentialsLive({ unshipped: true }, false), false)
  assert.equal(credentialsLive({ unshipped: false }, false), true)
  assert.equal(credentialsLive(null, true), true)
})
