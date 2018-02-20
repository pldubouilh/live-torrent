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

const chunkName = url => url.match(/\w+\d+(\.ts)/g)[0]

self.addEventListener('message', event => {
  // Data from main thread ! Just store AB on look up table
  const { url, ab } = event.data
  const name = chunkName(url)

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
  const manifestText = await reply.text()

  if (!manifestText.includes('magnet')) return reply

  const split = manifestText.split('\n')
  const manifest = split.filter(l => !l.includes('magnet')).join('\n')
  const magnets = split.filter(l => l.includes('magnet')).map(l => l.replace('###', ''))

  // If unchanged or if no last manifest, just reply to player (instant start)
  if (manifest === lastManifest || !lastManifest) {
    lastManifest = manifest
    return new Response(manifest)
  }

  // Ping main thread with magnet link. Lie to the video player to give WT some time to download new chunk
  msgClient(id, { magnets })
  const resp = new Response(lastManifest)
  lastManifest = manifest
  return resp
}

async function loadChunk (req, url, id) {
  // Request has already been fetched by p2p !
  const name = chunkName(url)
  if (localCache[name]) {
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
