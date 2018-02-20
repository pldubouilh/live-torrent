live-torrent
=============
![ex](https://user-images.githubusercontent.com/760637/36377295-f08d0ff2-1576-11e8-97c0-dcb91246529d.png)


Simple proof-of-concept for a live streaming solution based on [webtorrent](https://github.com/webtorrent/webtorrent). Video player courtesy of [hls.js](https://github.com/video-dev/hls.js/).



### Demo
Yes please ! Live demo with sintel at [live.computer](https://live.computer)

### Run it yourself
```sh
# Install
npm i -g live-torrent

# Start with example live-feed
live-torrent -u http://wms.shared.streamshow.it/carinatv/carinatv/ -p playlist.m3u8

# Open browser at http://127.0.0.1:8008
```

### FAQ
> I have a regular feed already

live-torrent can convert your feed into a webtorrent enabled feed. Just install the CLI tool and start converting your feed.

> I want to create a feed !

Have a look in the `server/` directory !

> How to implement on a website ?

Just host the script/sw yourself. Also, there are some limitations to the use of SW ; it needs to be served from HTTPS, and it should be located at the root of the domain (e.g. `https://live.computer/sw.js`). Also feel free to open an issue if something's acting weird :)

### How is it working ?

TLDR(ish); A server script parses the video manifest and generates a torrent magnet-link from the video chunks. The magnets are pushed on the manifest.

Now on the browser side, the videoplayer downloads the manifest, the SW hijacks the request, extracts the magnet, and tries to download the chunks via webtorrent. If if fails, it falls back the url provided (and then seed), otherwise, well p2p - yay !

Basically 3 different pieces are needed :
   1. cli.js, the server script that takes in a HLS feed and adds the magnet links to it
   2. serviceworker to proxy the manifest/chunks requests
   3. client script, that's the bit utilizing webtorrent (no webrtc in SW !)

### TODO:
- [x] Implement CLI tool that could live on top of existing feeds
- [ ] Optimise p2p - shave off more time for webtorrent to download the chunks
