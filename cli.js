#!/usr/bin/env node
const parseTorrent = require('parse-torrent')
const createTorrent = require('create-torrent')
const request = require('request-promise-native')
const argv = require('yargs').argv
const express = require('express')
const app = express()

let playlistLocation = ''
let playlistName = ''
let chunksLocation = ''
const announceList = [['wss://tracker.openwebtorrent.com']]
let manifest
let sequence = 0
const fileToMagnet = {}
const magnetsOrder = []
const entries = []

const help = `
🛰  Live-torrent 🛰
  -u   manifest location
  -p   playlist name
  -c   video chunk location                  - default same as url
  -r   manifest refresh rate (in seconds)    - default 5

  eg. live-torrent -u http://wms.shared.streamshow.it/carinatv/carinatv/ -p playlist.m3u8
`

function die (msg, code) {
  console.log(help + '\n' + msg)
  process.exit(code)
}

const computeMagnet = (file, fn) => {
  return new Promise(async (resolve, reject) => {
    file.name = fn
    createTorrent(file, { announceList }, (err, t) => {
      if (err) return console.log(err)
      const magnet = parseTorrent.toMagnetURI(parseTorrent(t))
      resolve(magnet)
    })
  })
}

async function makeMagnet (fn) {
  // Fetch payload and compute magnet
  const payload = await request(chunksLocation + fn, { encoding: null })
  const magnet = await computeMagnet(payload, fn)

  // Store magnet computed
  fileToMagnet[fn] = magnet
  magnetsOrder.push(fn)

  if (magnetsOrder.length > 20) {
    const oldMagnet = magnetsOrder.shift()
    delete fileToMagnet[oldMagnet]
  }
}

async function makeAllMagnets (files) {
  return Promise.all(files.map(makeMagnet))
}

async function doManifest (path = '') {
  const _manifest = await request(playlistLocation + (path || playlistName))

  // Head over to the playlist, if what we got was a link to a playlist
  if (_manifest.includes('.m3u8')) {
    const m3u8 = _manifest.split('\n').find(l => l.includes('.m3u8'))
    return doManifest(m3u8)
  }

  const split = _manifest.split('\n')

  // Get sequenece number
  const _sequence = split.filter(l => l.includes(`#EXT-X-MEDIA-SEQUENCE:`))[0].replace('#EXT-X-MEDIA-SEQUENCE:', '')
  if (_sequence === sequence) {
    return console.log('\nManifest unchanged\n')
  }

  // Split manifest
  sequence = _sequence
  const files = split.filter(l => l.includes('.ts'))
  const times = split.filter(l => l.includes('#EXTINF'))
  const head = split.filter(l => !times.includes(l) && !files.includes(l))
  const lastFile = files[files.length - 1]

  // Add entries with webtorrent
  if (!entries.length) {
    await makeAllMagnets(files)
    entries.push(`${times[0]}\n###${fileToMagnet[files[0]]}\n${chunksLocation + files[0]}`)
    entries.push(`${times[1]}\n###${fileToMagnet[files[1]]}\n${chunksLocation + files[1]}`)
    entries.push(`${times[2]}\n###${fileToMagnet[files[2]]}\n${chunksLocation + files[2]}`)
  } else {
    entries.shift()
    await makeMagnet(lastFile)
    entries.push(`${times[2]}\n###${fileToMagnet[files[2]]}\n${chunksLocation + files[2]}`)
  }

  manifest = head.join('\n') + entries.join('\n')
  console.log(manifest)
}

if (argv.h || argv.help) {
  die('', 0)
}

if (argv.u && argv.p) {
  console.log('Starting server\n')
  app.get('*.m3u8', (req, res) => res.send(manifest))
  app.use(express.static('client'))
  app.listen(8008)

  chunksLocation = argv.c || argv.u
  playlistLocation = argv.u
  playlistName = argv.p
  doManifest()
  setInterval(doManifest, (argv.r || 5) * 1000)
} else {
  die('', 0)
}
