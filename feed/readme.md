Put your manifest and HLS chunks here. Here's a script to get started quickly.

```
wget http://peach.themazzone.com/durian/movies/sintel-1024-surround.mp4
ffmpeg -i sintel-1024-surround.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls chunks.m3u8
mv chunks.m3u8 manifest.m3u8
```
