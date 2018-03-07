const parseTorrent = require('parse-torrent')
const createTorrent = require('create-torrent')
const request = require('request-promise-native')
const fs = require('fs-extra')
const StreamMaker = require('./streamMaker')

const chunkName = url => url.match(/\d+(\.ts)/g)[0]

const removeDanglingSlash = u => u.startsWith('/') ? u.substring(1) : u

const addTrailingSlash = u => u.endsWith('/') ? u : u + '/'

const isUrl = f => f.startsWith('http://') || f.startsWith('https://')

function wtManifest (fullManifestPath = '', makeFromFolder = '', delay, loop = false) {
  this.isLocalStream = makeFromFolder.length > 1

  // Torrent from local folder
  if (this.isLocalStream) {
    this.chunksLoc = ''
    this.localPath = addTrailingSlash(makeFromFolder)
    this.sm = makeFromFolder ? new StreamMaker(makeFromFolder, delay, loop) : null
  } else {
    // Manifest location is splitted ; Filename goes in manifestname, rest of the path in manifestLoc
    this.manifestLoc = fullManifestPath.split('/').slice(0, -1).join('/')
    this.manifestLoc = addTrailingSlash(this.manifestLoc)
    this.manifestName = fullManifestPath.split('/').pop()

    // If no full path in manifest, chunk location is the manifest path minus the manifest name
    this.chunksLoc = addTrailingSlash(fullManifestPath.split('/').slice(0, -1).join('/'))
  }

  this.announceList = [['wss://tracker.openwebtorrent.com']]
  this.fileToMagnet = {}
  this.magnetsOrder = []
  this.manifest = ''
  this.sequence = ''
}

wtManifest.prototype.computeMagnet = function (file, cn) {
  return new Promise((resolve, reject) => {
    file.name = cn
    createTorrent(file, { announceList: this.announceList }, (err, t) => {
      if (err) return console.log(err)
      const magnet = parseTorrent.toMagnetURI(parseTorrent(t))
      resolve(magnet)
    })
  })
}

wtManifest.prototype.makeMagnet = async function (f) {
  // Extract chunk name. Return magnet if already computed
  const self = this
  const cn = chunkName(f)
  if (self.fileToMagnet[cn]) return

  // Fetch payload and compute magnet
  const url = isUrl(f) ? f : self.chunksLoc + removeDanglingSlash(f)
  const payload = self.isLocalStream ? await fs.readFile(self.localPath + f) : await request(url, { encoding: null })

  const magnet = await self.computeMagnet(payload, cn)

  // Store magnet computed
  self.fileToMagnet[cn] = '###' + magnet + '\n' + url
  self.magnetsOrder.push(cn)

  if (self.magnetsOrder.length > 10) {
    const oldMagnet = self.magnetsOrder.shift()
    delete self.fileToMagnet[oldMagnet]
  }
}

wtManifest.prototype.makeAllMagnets = async function (files) {
  return Promise.all(files.map(this.makeMagnet, this))
}

wtManifest.prototype.makeManifest = async function (manifest) {
  const self = this

  // Split manifest and get sequenece number
  let split = manifest.split('\n')
  const sequence = split.find(l => l.includes(`#EXT-X-MEDIA-SEQUENCE:`))
  if (sequence === self.sequence) {
    return self.manifest
  }

  // Remove any existing magnet link from manifest (useful for testing)
  split = split.filter(l => !l.includes('magnet'))

  // Extract TS files and make magnet links
  const files = split.filter(l => l.includes('.ts'))
  await self.makeAllMagnets(files)

  // Pop manifest back, inject magnet links alongside TS files
  self.manifest = split.map(l => l.includes('.ts') ? self.fileToMagnet[chunkName(l)] : l).join('\n')
  self.sequence = sequence
  return self.manifest
}

wtManifest.prototype.doManifest = async function (extraManifestName) {
  let manifest

  if (this.isLocalStream) {
    manifest = await this.sm.makeLiveStream()
  } else {
    manifest = await request(this.manifestLoc + (extraManifestName || this.manifestName))

    // Head over to the playlist, if what we got was a link to a playlist. Taking only last link for now.
    if (manifest.replace(/\n$/, '').endsWith('.m3u8')) {
      const m3u8 = manifest.split('\n').find(l => l.includes('.m3u8'))
      return this.doManifest(m3u8)
    }
  }

  return this.makeManifest(manifest)
}

module.exports = wtManifest
