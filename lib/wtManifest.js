const parseTorrent = require('parse-torrent')
const createTorrent = require('create-torrent')
const request = require('request-promise-native')
const fs = require('fs-extra')
const StreamMaker = require('./streamMaker')

const chunkName = url => url.match(/\d+(\.ts)/g)[0]

function wtManifest (chunksLoc = '', manifestLoc = '', manifestName = '', makeFromFolder = '', loop = false, announceList = [['wss://tracker.openwebtorrent.com']]) {
  this.chunksLoc = chunksLoc.endsWith('/') ? chunksLoc : chunksLoc + '/'
  this.manifestLoc = manifestLoc.endsWith('/') ? manifestLoc : manifestLoc + '/'
  this.manifestName = manifestName

  this.localPath = makeFromFolder.endsWith('/') ? makeFromFolder : makeFromFolder + '/'
  this.isLocalStream = this.localPath.length > 1

  this.sm = makeFromFolder ? new StreamMaker(makeFromFolder, loop) : null

  this.announceList = announceList
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
      resolve('###' + magnet)
    })
  })
}

wtManifest.prototype.makeMagnet = async function (f) {
  // Extract chunk name. Return magnet if already computed
  const self = this
  const cn = chunkName(f)
  if (self.fileToMagnet[cn]) return

  // Fetch payload and compute magnet
  const payload = self.isLocalStream ? await fs.readFile(self.localPath + f) : await request(self.chunksLoc + f, { encoding: null })
  const magnet = await self.computeMagnet(payload, cn)

  // Store magnet computed
  self.fileToMagnet[cn] = magnet
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
  const sequence = split.filter(l => l.includes(`#EXT-X-MEDIA-SEQUENCE:`))[0].replace('#EXT-X-MEDIA-SEQUENCE:', '')
  if (sequence === self.sequence) {
    return self.manifest
  }

  // Remove any existing magnet link from manifest (useful for testing)
  split = split.filter(l => !l.includes('magnet'))

  // Extract TS files and make magnet links
  const files = split.filter(l => l.includes('.ts'))
  await self.makeAllMagnets(files)

  // Pop manifest back, inject magnet links alongside TS files
  self.manifest = split.map(l => l.includes('.ts') ? self.fileToMagnet[chunkName(l)] + '\n' + self.chunksLoc + l : l).join('\n')
  self.sequence = sequence
  return self.manifest
}

wtManifest.prototype.doManifest = async function (extraManifestName) {
  if (this.isLocalStream) {
    const manifest = await this.sm.makeLiveStream()
    return this.makeManifest(manifest)
  } else {
    const manifest = await request(this.manifestLoc + (extraManifestName || this.manifestName))

    // Head over to the playlist, if what we got was a link to a playlist. Taking only last link for now.
    if (manifest.replace(/\n$/, '').endsWith('.m3u8')) {
      const m3u8 = manifest.split('\n').find(l => l.includes('.m3u8'))
      return this.doManifest(m3u8)
    }

    return this.makeManifest(manifest)
  }
}

module.exports = wtManifest
