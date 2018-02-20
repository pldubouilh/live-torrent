const parseTorrent = require('parse-torrent')
const createTorrent = require('create-torrent')
const fs = require('fs-extra')
const m3u8 = require('m3u8')
const express = require('express')
const app = express()

const extraPath = ''
const pathChunks = 'feed/'
const chunkName = 'chunks'
const manifestName = 'manifest.m3u8'
const announceList = [['wss://tracker.btorrent.xyz']]
let targetDuration = 10

let magnets = {}
let chunk1 = 0
let chunk2 = 1
let chunk3 = 2
let manifest = ''

function parseManifest () {
  return new Promise((resolve, reject) => {
    const parser = m3u8.createStream()
    fs.createReadStream(pathChunks + manifestName).pipe(parser)
    parser.on('m3u', m3u => {
      const durations = m3u.items.PlaylistItem.map(i => i.properties.duration)
      resolve(durations)
    })
  })
}

const makeMagnet = file => {
  return new Promise(async (resolve, reject) => {
    if (magnets[file]) return resolve(magnets[file])

    const buffer = await fs.readFile(file)
    buffer.name = file
    createTorrent(buffer, { announceList }, (err, t) => {
      if (err) return console.log(err)
      const magnet = parseTorrent.toMagnetURI(parseTorrent(t))
      magnets[file] = magnet
      resolve(magnet)
    })
  })
}

async function makeLiveStream (cb) {
  const durations = await parseManifest()
  const magnet1 = await makeMagnet(pathChunks + chunkName + chunk1 + '.ts')
  const magnet2 = await makeMagnet(pathChunks + chunkName + chunk2 + '.ts')
  const magnet3 = await makeMagnet(pathChunks + chunkName + chunk3 + '.ts')

  let _manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${targetDuration}
#EXT-X-MEDIA-SEQUENCE:${chunk1}
#EXTINF: ${durations[chunk1]}
###${magnet1}
${extraPath}${chunkName}${chunk1}.ts
#EXTINF: ${durations[chunk2]}
###${magnet2}
${extraPath}${chunkName}${chunk2}.ts
#EXTINF: ${durations[chunk3]}
###${magnet3}
${extraPath}${chunkName}${chunk3}.ts`

  manifest = _manifest

  chunk1 = chunk1 === (durations.length - 1) ? 0 : chunk1 + 1
  chunk2 = chunk2 === (durations.length - 1) ? 0 : chunk2 + 1
  chunk3 = chunk3 === (durations.length - 1) ? 0 : chunk3 + 1

  console.log('\n\n' + _manifest)
  return cb ? cb() : null
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

app.get('*.m3u8', (req, res) => res.send(manifest))
app.use(express.static('feed'))
app.use(express.static('client'))

makeLiveStream(() => {
  setInterval(makeLiveStream, targetDuration * 1000)
  app.listen(8008)
})
