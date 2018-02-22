/* eslint-env browser */
const WebTorrent = require('webtorrent')
const client = new WebTorrent()

const torrents = [] // {name, magnetURI}
const announceList = [['wss://tracker.openwebtorrent.com']]

window.p2p = 0
window.server = 0

console.logColor = (msg, color) => console.log('%c' + msg, `color: ${color}; font-size: 11px;`)

console.logNoisy = (msg, color) => !(new Date().getTime() % 12) && console.logColor(msg, color)

navigator.serviceWorker.register('sw.js').then(() => {
  navigator.serviceWorker.addEventListener('message', msg => {
    return msg.data.ab ? newSeed(msg.data.name, msg.data.ab) : newTorrent(msg.data.magnets)
  })
}).catch(() => console.log('SW registration failure'))

function cleanupTorrents () {
  if (torrents.length < 5) return
  const oldTorrent = torrents.shift()
  client.remove(oldTorrent.magnetURI)
}

function isTorrentAdded (input) {
  // Find per magnet and filename
  if (torrents.find(t => t.magnetURI === input)) return true
  if (torrents.find(t => t.name === input)) return true
  return false
}

function onUpload (t) {
  console.logNoisy(`+ P2P Upload on ${t.name}`, 'indianred')
}

function onDownload (t) {
  console.logNoisy(`+ P2P Download on ${t.name}, progress: ${t.progress.toString().slice(0, 3)}`, 'darkseagreen')
}

function onDone (t) {
  t.files[0].getBuffer((err, b) => {
    if (err) return console.log(err)
    console.logColor(`+ P2P over for ${t.files[0].name} - downloaded ${t.downloaded} bytes`, 'forestgreen')
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    window.p2p += ab.byteLength
    navigator.serviceWorker.controller.postMessage({ name: t.files[0].name, ab }, [ab])
  })
}

function onAdded (t, isSeed) {
  console.log(`+ ${isSeed ? 'Seeding' : 'Trying p2p for'} ${t.name}, magnet: ${t.magnetURI.slice(0, 30)}`)
  torrents.push({ name: t.name, magnetURI: t.magnetURI })
  cleanupTorrents()
}

function newTorrent (magnets) {
  magnets.forEach(magnet => {
    if (isTorrentAdded(magnet)) return
    const t = client.add(magnet)
    t.on('infoHash', () => onAdded(t))
    t.on('download', () => onDownload(t))
    t.on('done', () => onDone(t))
    t.on('upload', () => onUpload(t))
  })
}

function newSeed (name, ab) {
  console.logColor(`+ Server loaded ${name} - seeding content now`, 'cadetblue')
  window.server += ab.byteLength

  if (isTorrentAdded(name)) {
    const { magnetURI } = torrents.find(t => t.name === name)
    const i = torrents.findIndex(t => t.name === name)
    torrents.splice(i, 1)
    client.remove(magnetURI)
  }

  const buffer = Buffer.from(ab)
  buffer.name = name
  const t = client.seed(buffer, { announceList }, t => onAdded(t, true))
  t.on('upload', () => onUpload(t))
}
