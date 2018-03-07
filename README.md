live-torrent
=============

[![Build Status](https://travis-ci.org/pldubouilh/live-torrent.svg?branch=master)](https://travis-ci.org/pldubouilh/live-torrent)


![ex](https://user-images.githubusercontent.com/760637/36377295-f08d0ff2-1576-11e8-97c0-dcb91246529d.png)


Simple proof-of-concept for a live streaming solution based on [webtorrent](https://github.com/webtorrent/webtorrent). Video player courtesy of [hls.js](https://github.com/video-dev/hls.js/).


### Demo
Yes please ! Live demo with sintel at [live.computer](https://live.computer)

### Run it yourself
```sh
# Install
npm i -g live-torrent

# Start with example live-feed
live-torrent -v -u https://live.computer/manifest.m3u8

# ... or Create a Webtorrent enabled feed from a folder with .ts files
live-torrent -v -l -f feed

# Open browser at http://127.0.0.1:8008
```

### FAQ
> I have a regular feed already

live-torrent can convert your feed into a webtorrent enabled feed. The first example command above will download the feed at `https://live.computer/manifest.m3u8`, and generate a webtorrent-enabled HLS feed from it. Just open your web-browser at `http://127.0.0.1:8008` to have a look.

> I want to create a feed !

No problem - the second example up here will generate a feed for the directory `feed`, how simple ! New chunks added to the directory will be pushed to the manifest.

Have a look in the [feed directory](https://github.com/pldubouilh/live-torrent/tree/master/feed) for instructions on how to generate a sample feed from a mp4 file.

> How to implement on a website ?

Just host the script, serviceworker and videoplayer on your site and you're good to go. Also, there are some limitations to the use of SW ; the site hosting the videoplayer needs to be served from HTTPS, and serviceworker should be located at the root of the domain (e.g. `https://live.computer/sw.js`). Also feel free to open an issue if something's acting weird :)

> Do I need CORS ?

Yes ! [But it's easy to enable](https://enable-cors.org/server.html). It's enabled by default using the "create from a folder" option.

### How is it working ?
TLDR(ish); A server script parses the video manifest and generates torrent magnet links from the video chunks. The magnets are pushed on the manifest.

Now on the browser side, the videoplayer downloads the manifest, the serviceworker hijacks the request, extracts the magnet links, and tries to download the chunks via webtorrent. If it fails, it falls back to the manifest url (and then seed), otherwise, well p2p - yay !

Basically 3 different pieces are needed :
   1. a server script to make a HLS manifest with magnet links in it
   2. serviceworker to proxy the manifest/chunks requests
   3. client script, that's the bit utilizing webtorrent (no webrtc in SW !)

### TODO:
- [x] Implement CLI tool that could live on top of existing feeds
- [ ] Optimise p2p - shave off more time for webtorrent to download the chunks
