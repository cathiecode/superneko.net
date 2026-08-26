# MediaMTX for Superneko Howl

Merge the service in `compose.yml` into the VPS Misskey Compose file. Set
`LIVE_CALLBACK_SECRET` to the same value as `liveStreaming.callbackSecret`, and
replace `CHANGE_ME` in `mediamtx.yml` when running that file without the Compose
environment override.

Route the LL-HLS origin (for example `live.superneko.net`) to port 8888. Expose
1935 for RTMP publishing and 8554 for public-Howl RTSP viewing. Misskey still
authorizes every publish/read request, so knowing a media path alone is not
enough to watch it. RTSP URLs are only issued for public Howls.

HLS segments stay in memory (`hlsDirectory: ""`), are limited by
`hlsSegmentCount`, and the inactive muxer closes after 60 seconds. They do not
accumulate on disk.
