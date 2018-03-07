#!/usr/bin/env node
const WtManifest = require('./lib/wtManifest')
const argv = require('yargs').argv
const express = require('express')
const app = express()

console.verbose = m => argv.v && (console.log('\x1Bc') || console.log(m))

const help = `🛰 Live-torrent 🛰

# To convert an existing stream to a live-torrent feed
  -u   manifest location

# To create a stream from a folder with HLS chunks
  -f   folder with chunks location
  -l   start from beggining and loop     - default false

# Misc
  -s   add simple testpage to server     - default true
  -v   display manifest when generated   - default false
  -r   manifest refresh rate (in sec.)   - default 2


eg. from existing feed
  live-torrent -v -u https://live.computer/manifest.m3u8

eg. from local folder with ts files
  live-torrent -v -l -f feed/
`

function die (msg, code) {
  console.log(msg.error ? msg.error : '\n' + msg)
  process.exit(code)
}

if (argv.h || argv.help || !(argv.u || argv.f)) {
  die(help, 0)
}

console.log('\nStarting server on port 8008\n')
const sampleWebserver = typeof argv.s === 'undefined' ? true : (argv.s === 'true')
const delay = parseInt(argv.r || 10)

const manifestLocation = argv.u
const makeFromFolder = argv.f
const loop = !!argv.l

const wtm = new WtManifest(manifestLocation, makeFromFolder, delay, loop)

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

app.get('*.m3u8', (req, res) => res.send(wtm.manifest))

if (sampleWebserver) app.use(express.static('client'))

if (makeFromFolder) app.use(express.static(makeFromFolder))

const makeManifest = async (cb) => {
  try {
    await wtm.doManifest()
  } catch (e) { die(e, 1) }

  if (!app.started) {
    app.started = true
    app.listen(8008)
  }

  console.verbose(`
  ${sampleWebserver ? '### Sample client fileserver running on http://127.0.0.1:8008' : ''}
  ### Manifest at: http://127.0.0.1:8008/manifest.m3u8
  ### Manifest generated on: ${new Date()}\n\n${wtm.manifest}`)
}

makeManifest()
setInterval(makeManifest, delay * 1000)
