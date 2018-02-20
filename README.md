live-torrent
=============
![ex](https://user-images.githubusercontent.com/760637/36377295-f08d0ff2-1576-11e8-97c0-dcb91246529d.png)


Simple proof-of-concept for a live streaming solution based on [webtorrent](https://github.com/webtorrent/webtorrent). Video player courtesy of [hls.js](https://github.com/video-dev/hls.js/).

### Demo
Yes please ! Live demo at [live.computer](https://live.computer)

### Run it yourself
```sh
# Download sintel (or use any mp4, h264 encoded file)
cd feed
wget http://peach.themazzone.com/durian/movies/sintel-1024-surround.mp4

# Generate a HLS stream - needs ffmpeg 3+
ffmpeg -i sintel-1024-surround.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls chunks.m3u8
mv chunks.m3u8 manifest.m3u8

# Install deps and run
cd ..
npm i
npm run test

# Open browser at http://127.0.0.1:8008
```

### How is it working ?

TLDR(ish); A server script parses the video manifest and generates a torrent magnet-link from the video chunks. The magnets are pushed on the manifest.

Now on the browser side, the videoplayer downloads the manifest, the SW hijacks the request, extract the magnet, and tries to download the chunks via webtorrent. If if fails, it falls back to server (and then seed), otherwise, well p2p - yay !

Basically 3 different pieces are needed :
   1. server script to pre-compute the torrent magnet link of the video chunks, and add the magnet link to the manifest
   2. serviceworker to proxy the manifest/chunks requests
   3. client script, that's the bit utilizing webtorrent (no webrtc in SW !)


### FAQ

> Is it ok to use an external storage solution for my video chunks, or should I deliver them from here too ?

Just set the location of the chunks in [the server script](https://github.com/pldubouilh/live-torrent/blob/master/server/slicendice.js#L8).

> How to implement on a website ?

Just host the script/sw yourself. Also, there are some limitations to the use of SW ; it needs to be served from HTTPS, and it should be located at the root of the domain (e.g. `https://live.computer/sw.js`). Also feel free to open an issue if something's acting weird :)

### TODO:
- [ ] Optimise p2p - shave off more time for webtorrent to download the chunks
- [ ] Implement CLI tool that could live on top of existing feeds
