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

const help = `
🛰 Live-torrent 🛰
  -u   manifest location
  -p   playlist name
  -c   video chunk location                  - default same as url
  -r   manifest refresh rate (in seconds)    - default 5

  eg. live-torrent -u http://wms.shared.streamshow.it/carinatv/carinatv/ -p playlist.m3u8
`

const chunkName = url => url.match(/\d+(\.ts)/g)[0]

function die (msg, code) {
  console.log(help + '\n' + msg)
  process.exit(code)
}

function computeMagnet (file, cn) {
  return new Promise((resolve, reject) => {
    file.name = cn
    createTorrent(file, { announceList }, (err, t) => {
      if (err) return console.log(err)
      const magnet = parseTorrent.toMagnetURI(parseTorrent(t))
      resolve('###' + magnet)
    })
  })
}

async function makeMagnet (fn) {
  // Extract chunk name. Return magnet if already computed
  const cn = chunkName(fn)
  if (fileToMagnet[cn]) return fileToMagnet[cn]

  // Fetch payload and compute magnet
  const payload = await request(chunksLocation + fn, { encoding: null })
  const magnet = await computeMagnet(payload, cn)

  // Store magnet computed
  fileToMagnet[cn] = magnet
  magnetsOrder.push(cn)

  if (magnetsOrder.length > 10) {
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

  // Split manifest and get sequenece number
  let split = _manifest.split('\n')
  const _sequence = split.filter(l => l.includes(`#EXT-X-MEDIA-SEQUENCE:`))[0].replace('#EXT-X-MEDIA-SEQUENCE:', '')
  if (_sequence === sequence) {
    return console.log('\nManifest unchanged\n')
  }

  // Remove any existing magnet link from manifest (useful for testing)
  split = split.filter(l => !l.includes('magnet'))

  // Extract TS files and make magnet links
  const files = split.filter(l => l.includes('.ts'))
  await makeAllMagnets(files)

  // Pop manifest back, inject magnet links alongside TS files
  manifest = split.map(l => l.includes('.ts') ? fileToMagnet[chunkName(l)] + '\n' + chunksLocation + l : l).join('\n')
  sequence = _sequence
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
