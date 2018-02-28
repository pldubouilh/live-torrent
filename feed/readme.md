Here's a quick howto to get started from a video file.

```sh
# Download test file, or use any mp4, h264 encoded file
cd feed
wget http://peach.themazzone.com/durian/movies/sintel-1024-surround.mp4


# Convert to HLS (needs ffmpeg 3+)
ffmpeg -i sintel-1024-surround.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls chunks.m3u8
rm chunks.m3u8
cd ..

# Start feed from folder. Note the -l argument to loop over when video is over
live-torrent -l -v -f feed
```
