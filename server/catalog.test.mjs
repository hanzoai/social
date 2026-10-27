import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONNECT_CREDENTIALS,
  cardCopy,
  catalogState,
  providerMissing,
  providerPath,
  readConnections,
  settleConnections,
} from '../src/catalog.ts'

const NETWORKS = ['x', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads']

test('catalog state is loading, failed, or answered — never inferred from a missing row alone', () => {
  assert.equal(catalogState(false, false, undefined), 'loading')
  assert.equal(catalogState(false, true, undefined), 'failed')
  assert.equal(catalogState(true, false, undefined), 'ready')
  assert.equal(catalogState(true, true, undefined), 'ready')
  assert.equal(catalogState(true, false, { failed: 'nope' }), 'failed')
})

test('a card does not call a loading or failed catalog "not in the catalog"', () => {
  const loading = cardCopy({
    name: 'X',
    provider: 'x',
    catalog: 'loading',
    missingCredentials: ['X_API_KEY', 'X_API_SECRET'],
  })
  assert.equal(loading.caption, 'Reading the connector catalog…')
  assert.equal(loading.needs, null)
  assert.match(loading.publishing, /X_API_KEY, X_API_SECRET/)

  // A connection object that arrived from somewhere else must not override the
  // fact that THIS read has not answered. That was the bug: description ?? fallback.
  const premature = cardCopy({
    name: 'X',
    provider: 'x',
    catalog: 'loading',
    connection: { description: 'Post to X', available: false },
  })
  assert.equal(premature.caption, 'Reading the connector catalog…')
  assert.equal(premature.needs, null)

  const failed = cardCopy({ name: 'YouTube', provider: 'youtube', catalog: 'failed' })
  assert.equal(failed.caption, 'The connector catalog could not be read.')
  assert.equal(failed.needs, null)

  const failedBecause = cardCopy({
    name: 'YouTube',
    provider: 'youtube',
    catalog: 'failed',
    detail: 'the gateway timed out',
  })
  assert.equal(failedBecause.caption, 'The connector catalog could not be read. the gateway timed out')
  assert.equal(failedBecause.needs, null)
})

test('a network the registry answered without is actually missing', () => {
  const copy = cardCopy({
    name: 'Threads',
    provider: 'threads',
    catalog: 'ready',
    missingCredentials: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],
  })
  assert.equal(copy.caption, 'This network is not in the connector catalog.')
  assert.equal(copy.needs, null)
  assert.match(copy.publishing, /THREADS_APP_ID/)
})

test('present but unavailable names the connect-plane variables, and the publish plane when it differs', () => {
  const x = cardCopy({
    name: 'X',
    provider: 'x',
    catalog: 'ready',
    connection: { description: 'Post to X', available: false },
    missingCredentials: ['X_API_KEY', 'X_API_SECRET'],
  })
  assert.equal(x.caption, 'Post to X')
  assert.match(x.needs, /no app credentials for X/)
  assert.match(x.needs, /X_CLIENT_ID, X_CLIENT_SECRET/)
  assert.doesNotMatch(x.needs, /X_API_KEY/)
  assert.match(x.publishing, /X_API_KEY, X_API_SECRET/)

  const instagram = cardCopy({
    name: 'Instagram',
    provider: 'instagram',
    catalog: 'ready',
    connection: { description: 'Post to Instagram', available: false },
    missingCredentials: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  })
  assert.match(instagram.needs, /INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET/)
  assert.match(instagram.publishing, /FACEBOOK_APP_ID, FACEBOOK_APP_SECRET/)

  const facebook = cardCopy({
    name: 'Facebook',
    provider: 'facebook',
    catalog: 'ready',
    connection: { available: false, description: '' },
    missingCredentials: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  })
  assert.equal(facebook.caption, '')
  assert.match(facebook.needs, /FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET/)

  const threads = cardCopy({
    name: 'Threads',
    provider: 'threads',
    catalog: 'ready',
    connection: { description: 'Post to Threads', available: false },
    missingCredentials: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],
  })
  assert.match(threads.needs, /THREADS_CLIENT_ID, THREADS_CLIENT_SECRET/)
  assert.match(threads.publishing, /THREADS_APP_ID/)

  // LinkedIn already uses one vocabulary, so the card says it once.
  const linkedin = cardCopy({
    name: 'LinkedIn',
    provider: 'linkedin',
    catalog: 'ready',
    connection: { description: 'Post to LinkedIn', available: false },
    missingCredentials: ['LINKEDIN_CLIENT_SECRET', 'LINKEDIN_CLIENT_ID'],
  })
  assert.match(linkedin.needs, /LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET/)
  assert.equal(linkedin.publishing, null)

  const tiktok = cardCopy({
    name: 'TikTok',
    provider: 'tiktok',
    catalog: 'ready',
    connection: { description: 'Post to TikTok', available: false },
  })
  assert.match(tiktok.needs, /TIKTOK_CLIENT_ID, TIKTOK_CLIENT_SECRET/)
  assert.equal(tiktok.publishing, null)

  const youtube = cardCopy({
    name: 'YouTube',
    provider: 'youtube',
    catalog: 'ready',
    connection: { description: 'Upload to YouTube', available: false },
    missingCredentials: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  })
  assert.match(youtube.needs, /YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET/)
  assert.equal(youtube.publishing, null)
})

test('a connectable network offers no credential lecture, and still reports a publish plane that disagrees', () => {
  const ready = cardCopy({
    name: 'X',
    provider: 'x',
    catalog: 'ready',
    connection: { description: 'Post to X', available: true },
  })
  assert.equal(ready.caption, 'Post to X')
  assert.equal(ready.needs, null)
  assert.equal(ready.publishing, null)

  const split = cardCopy({
    name: 'X',
    provider: 'x',
    catalog: 'ready',
    connection: { description: 'Post to X', available: true },
    missingCredentials: ['X_API_KEY', 'X_API_SECRET'],
  })
  assert.equal(split.needs, null)
  assert.match(split.publishing, /Publishing to X also needs X_API_KEY, X_API_SECRET/)
})

test('an unknown network with no social names keeps the credential sentence and invents none', () => {
  const copy = cardCopy({
    name: 'Bluesky',
    provider: 'bluesky',
    catalog: 'ready',
    connection: { description: 'Post to Bluesky', available: false },
  })
  assert.equal(
    copy.needs,
    'This deployment holds no app credentials for Bluesky, so there is nothing to consent to yet.',
  )
  assert.equal(copy.publishing, null)
})

test('connect credentials cover the seven networks and no others', () => {
  assert.deepEqual(Object.keys(CONNECT_CREDENTIALS), NETWORKS)
  for (const id of NETWORKS) assert.equal(CONNECT_CREDENTIALS[id].length, 2)
})

test('provider paths are one id, never the unfiltered registry', () => {
  assert.equal(providerPath('x'), '/v1/provider/x')
  assert.equal(providerPath('you tube'), '/v1/provider/you%20tube')
  assert.notEqual(providerPath('x'), '/v1/provider')
})

test('a 404 is absence and any other refusal stays on that id', async () => {
  assert.equal(providerMissing({ status: 404 }), true)
  assert.equal(providerMissing({ status: 503 }), false)
  assert.equal(providerMissing(new Error('nope')), false)
  assert.equal(providerMissing(null), false)

  const seen = []
  const rows = await readConnections(['x', 'facebook', 'instagram'], async (id) => {
    seen.push(id)
    if (id === 'facebook') {
      const missing = new Error('no such provider')
      missing.status = 404
      throw missing
    }
    if (id === 'instagram') {
      const down = new Error('boom')
      down.status = 503
      throw down
    }
    return { id, available: false, description: id }
  })
  assert.deepEqual(seen, ['x', 'facebook', 'instagram'])
  assert.equal(rows[0].connection.id, 'x')
  assert.equal(rows[1].connection, undefined)
  assert.equal(rows[1].error, undefined)
  assert.equal(rows[2].error.status, 503)

  const settled = settleConnections(rows, (error) => error.message)
  assert.equal(settled[1].connection, undefined)
  assert.equal(settled[1].failed, undefined)
  assert.equal(settled[2].failed, 'boom')
  assert.equal(settled[2].connection, undefined)
})

test('every id failing is one catalog failure, not seven absences', () => {
  const error = Object.assign(new Error('unauthorized'), { status: 401 })
  assert.throws(
    () =>
      settleConnections(
        [
          { id: 'x', error },
          { id: 'facebook', error },
        ],
        () => 'ignored',
      ),
    (thrown) => thrown === error,
  )
})

test('an empty id list is an empty answer, not a throw', async () => {
  const rows = await readConnections([], async () => {
    throw new Error('should not be asked')
  })
  assert.deepEqual(settleConnections(rows, () => 'nope'), [])
})
