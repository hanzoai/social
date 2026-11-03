import assert from 'node:assert/strict'
import test from 'node:test'

import { check, rule } from '../src/network.ts'

const NETWORKS = [
  'x', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads',
  'bluesky', 'mastodon', 'pinterest', 'reddit', 'telegram-bot', 'discord-webhook',
]

test('every network the platform names has its own rule, with a name a person knows', () => {
  for (const id of NETWORKS) {
    const it = rule(id)
    assert.notEqual(it.name, id.includes('-') || id === 'x' ? id : '', id)
    assert.ok(it.text > 0, id)
  }
  assert.equal(rule('telegram-bot').name, 'Telegram')
  assert.equal(rule('discord-webhook').name, 'Discord')
})

test('Bluesky stops at 300 characters, four photos and no video', () => {
  const long = 'w'.repeat(301)
  assert.match(check('bluesky', long, [])[0], /1 characters over Bluesky's limit of 300/)
  assert.deepEqual(check('bluesky', 'hi', ['https://c.example.com/a.png']), [])
  assert.match(check('bluesky', 'hi', ['https://c.example.com/a.mp4']).join(' '), /does not take video/)
  const five = ['1', '2', '3', '4', '5'].map((n) => `https://c.example.com/${n}.png`)
  assert.match(check('bluesky', 'hi', five).join(' '), /takes 4 photos, not 5/)
})

test('Pinterest needs a photo and takes no video', () => {
  assert.match(check('pinterest', 'a pin', []).join(' '), /needs a photo or a video/)
  assert.match(check('pinterest', 'a pin', ['https://c.example.com/a.mp4']).join(' '), /does not take video/)
  assert.deepEqual(check('pinterest', 'a pin', ['https://c.example.com/a.png']), [])
})

test('Mastodon takes photos or a video, never both', () => {
  assert.deepEqual(check('mastodon', 'hi', ['https://c.example.com/a.mp4']), [])
  assert.match(check('mastodon', 'hi', ['https://c.example.com/a.mp4', 'https://c.example.com/a.png']).join(' '), /whole post/)
})

test('Discord and Telegram take words alone, and photos with videos together', () => {
  for (const id of ['discord-webhook', 'telegram-bot']) {
    assert.deepEqual(check(id, 'hi', []), [])
    assert.deepEqual(check(id, 'hi', ['https://c.example.com/a.png', 'https://c.example.com/b.mp4']), [])
  }
  assert.match(check('discord-webhook', 'w'.repeat(2001), []).join(' '), /over Discord's limit of 2000/)
})
