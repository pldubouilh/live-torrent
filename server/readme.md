Here's a quick howto on how to get started from a video file.

```sh
# Download test file, or use any mp4, h264 encoded file
mkdir feed && cd feed
wget http://peach.themazzone.com/durian/movies/sintel-1024-surround.mp4

# Convert to HLS (needs ffmpeg 3+)
ffmpeg -i sintel-1024-surround.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls chunks.m3u8

# Rename manifest
mv chunks.m3u8 manifest.m3u8

# Start server script that will chop the HLS manifest into a live strean, and then serve your chunks and the client test page
cd ..
node server/slicendice.js
```
