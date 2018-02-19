/* eslint-env serviceworker, browser */

let lastManifest
let localCache = {}
let localCacheOrder = []

async function msgClient (id, msg) {
  const c = await self.clients.get(id)
  if (!c) return
  const chan = new MessageChannel()
  if (msg.ab) {
    c.postMessage(msg, [chan.port2, msg.ab])
  } else {
    c.postMessage(msg, [chan.port2])
  }
}

self.addEventListener('message', event => {
  // Data from main thread ! Just store AB on look up table
  const { url, ab } = event.data
  localCache[location.origin + '/' + url] = ab // TODO: fix location. Use chunkname instead of path
  console.log('- Received p2p data from main thread data for ' + url)

  // Clean LUT if needed
  localCacheOrder.push(url)
  if (localCacheOrder.length > 5) {
    const pastUrl = localCacheOrder.shift()
    delete localCache[pastUrl]
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
  if (localCache[url]) {
    return new Response(localCache[url])
  }

  // If not prefetched, go fetch it. Message the arraybuffer back to main thread for seeding.
  const res = await fetch(req)
  const ab = await res.clone().arrayBuffer()
  msgClient(id, { url, ab })
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
