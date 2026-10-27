import assert from 'node:assert/strict'
import test from 'node:test'

import {
  accountLine,
  audienceLabel,
  audiencesFor,
  readAudiences,
  whereLine,
  writeAudiences,
} from '../src/audience.ts'

test('each network names personal and its own kind of business account', () => {
  assert.deepEqual(
    audiencesFor('x').map((choice) => choice.label),
    ['Personal', 'Company'],
  )
  assert.deepEqual(
    audiencesFor('linkedin').map((choice) => choice.label),
    ['Personal', 'Company Page'],
  )
  assert.deepEqual(
    audiencesFor('facebook').map((choice) => choice.label),
    ['Personal', 'Page'],
  )
  assert.deepEqual(
    audiencesFor('instagram').map((choice) => choice.label),
    ['Personal', 'Business'],
  )
  assert.equal(audienceLabel('tiktok', 'business'), 'Business')
  assert.equal(audienceLabel('x', undefined), '')
})

test('a kind map ignores anything that is not personal or business', () => {
  assert.deepEqual(
    readAudiences({
      accounts: { a: 'personal', b: 'business', c: 'page', d: '', e: 1 },
      posts: { keep: true },
    }),
    { a: 'personal', b: 'business' },
  )
  assert.deepEqual(readAudiences(null), {})
  assert.deepEqual(readAudiences({ accounts: ['personal'] }), {})
})

test('writing kinds keeps every other settings key', () => {
  const next = writeAudiences(
    { posts: { p1: { tone: 'plain' } }, accounts: { old: 'personal' } },
    { acct_x: 'business' },
  )
  assert.deepEqual(next.posts, { p1: { tone: 'plain' } })
  assert.deepEqual(next.accounts, { acct_x: 'business' })
  assert.deepEqual(writeAudiences(undefined, { a: 'personal' }).accounts, { a: 'personal' })
})

test('several accounts on one network are counted and their kinds named once', () => {
  const audiences = { personal: 'personal', company: 'business', bare: 'personal' }
  assert.equal(
    whereLine(
      'linkedin',
      [{ id: 'personal' }, { id: 'company' }, { id: 'bare' }],
      audiences,
    ),
    'Where posts go — 3 accounts · Personal, Company Page',
  )
  assert.equal(accountLine(1, ['Personal']), '1 account · Personal')
  assert.equal(accountLine(0, []), '0 accounts')
  assert.equal(
    whereLine('x', [{ id: 'missing' }], {}),
    'Where posts go — 1 account',
  )
})
