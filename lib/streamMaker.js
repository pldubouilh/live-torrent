const fs = require('fs-extra')
const getDuration = require('get-video-duration')

const chunkName = url => url.match(/\d+(\.ts)/g)[0].replace('.ts', '')

const now = () => new Date().getTime()

function StreamMaker (loc, targetDuration = 10, loop = false) {
  this.chunk1 = 0
  this.chunk2 = 1
  this.chunk3 = 2
  this.loop = loop
  this.targetDuration = targetDuration
  this.lastModif = now()
  this.loc = loc.endsWith('/') ? loc : loc + '/'

  fs.watch(loc, (ev, fn) => { this.lastModif = now() })
}

StreamMaker.prototype.readLocal = async function (chunkNames) {
  // Read local folder, extract chunk ids and map ids to filenames
  const ls = await fs.readdir(this.loc)
  const ids = ls.filter(i => i.includes('.ts')).map(chunkName).map(i => parseInt(i)).sort((a, b) => a - b)

  const idToChunkname = {}
  ls.filter(i => i.includes('.ts')).forEach(el => { idToChunkname[chunkName(el)] = el })
  return { idToChunkname, ids }
}

StreamMaker.prototype.loopFeed = async function () {
  // Make a looping stream out of the folder
  const { idToChunkname, ids } = await this.readLocal()

  this.chunk1 = this.chunk1 = this.chunk1 === (ids.length - 1) ? 0 : this.chunk1 + 1
  this.chunk2 = this.chunk2 = this.chunk2 === (ids.length - 1) ? 0 : this.chunk2 + 1
  this.chunk3 = this.chunk3 = this.chunk3 === (ids.length - 1) ? 0 : this.chunk3 + 1

  return idToChunkname
}

StreamMaker.prototype.normalFeed = async function () {
  // Make a normal stream out of the folder. Just takes the last chunks and make a manifest ouf of them
  const { idToChunkname, ids } = await this.readLocal()

  // Remove last item from list if file is currently being written
  if (now() - this.lastModif < 200) ids.pop()

  this.chunk1 = ids[ids.length - 3]
  this.chunk2 = ids[ids.length - 2]
  this.chunk3 = ids[ids.length - 1]

  return idToChunkname
}

StreamMaker.prototype.makeLiveStream = async function () {
  const idToChunkname = this.loop ? await this.loopFeed() : await this.normalFeed()

  const chunkname1 = idToChunkname[this.chunk1]
  const chunkname2 = idToChunkname[this.chunk2]
  const chunkname3 = idToChunkname[this.chunk3]
  const dur1 = await getDuration(this.loc + chunkname1)
  const dur2 = await getDuration(this.loc + chunkname2)
  const dur3 = await getDuration(this.loc + chunkname3)

  const discontinuity = this.chunk3 !== this.chunk2 + 1

  const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${this.targetDuration}
#EXT-X-MEDIA-SEQUENCE:${this.chunk1}
#EXTINF: ${dur1}\n${chunkname1}
#EXTINF: ${dur2}\n${chunkname2}${discontinuity ? '\n#EXT-X-DISCONTINUITY' : ''}
#EXTINF: ${dur3}\n${chunkname3}`

  return manifest
}

// const sm = new StreamMaker('..//feed')
// setInterval(() => sm.makeLiveStream(), 500)

module.exports = StreamMaker
