/* eslint-env serviceworker, browser */

let lastManifest
let localCache = {}
let localCacheOrder = []

async function msgClient (id, msg) {
  const c = await self.clients.get(id)
  if (!c) return
  const chan = new MessageChannel()
  c.postMessage(msg, msg.ab ? [chan.port2, msg.ab] : [chan.port2])
}

const chunkName = url => url.match(/\d+(\.ts)/g)[0]

self.addEventListener('message', event => {
  // Data from main thread ! Just store AB on look up table
  const { name, ab } = event.data
  localCache[name] = ab
  console.log('- Received p2p data from main thread data for ' + name)

  // Clean LUT if needed
  localCacheOrder.push(name)
  if (localCacheOrder.length > 5) {
    const pastName = localCacheOrder.shift()
    delete localCache[pastName]
  }
})

async function loadManifest (req, url, id) {
  // Download manifest, extract filenames and magnet links
  const reply = await fetch(req)
  const manifestText = await reply.clone().text()

  // Just reply manifest if no magnet link, or if manifest unchanged
  if (manifestText === lastManifest || !manifestText.includes('magnet')) return reply

  // Extract magnet
  const magnets = manifestText.split('\n').filter(l => l.includes('magnet')).map(l => l.replace('###', ''))

  // If starting, only downlaod last chunk of manifest (instant server start)
  if (!lastManifest) {
    magnets.splice(0, magnets.length - 1)
  }

  // Ping main thread with magnet link. Lie to the video player to give WT some time to download new chunk
  msgClient(id, { magnets })
  const resp = new Response(lastManifest || manifestText)
  lastManifest = manifestText
  return resp
}

async function loadChunk (req, url, id) {
  // Request has already been fetched by p2p !
  const name = chunkName(url)
  if (localCache[name]) {
    console.log('- Feeding player with p2p data for ' + name)
    return new Response(localCache[name])
  }

  // If not prefetched, go fetch it. Message the arraybuffer back to main thread for seeding.
  const res = await fetch(req)
  const ab = await res.clone().arrayBuffer()
  msgClient(id, { name, ab })
  return res
}

self.addEventListener('install', event => self.skipWaiting())

self.addEventListener('activate', event => self.clients.claim())

self.addEventListener('fetch', event => {
  const url = event.request.url

  if (event.request.method === 'GET' && url.includes('.m3u8')) {
    event.respondWith(loadManifest(event.request, url, event.clientId))
  } else if (event.request.method === 'GET' && url.includes('.ts')) {
    event.respondWith(loadChunk(event.request, url, event.clientId))
  }
})
