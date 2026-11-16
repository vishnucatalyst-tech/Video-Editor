# Edit log — 2026-11-16_meta-terms-update

Rendered 2026-11-16 22:31

**Output:** 1080x1920 h264 30 fps, 20.00s, aac 48000 Hz, -14.3 LUFS, TP -2.3 dBTP, 7.0 MB

**Audio:** music music_comp.wav (+0 dB); 0.3 s fade in/out; two-pass loudnorm to -14 LUFS / -1.5 dBTP

## Cuts

| # | Timeline | Source | In → Out | Punch-in | Notes |
|---|---|---|---|---|---|
| 1 |   0.00 →  20.00 | 01_scene.mp4 | 0.00 → 20.00 | 1.00× | premium-motion: hook 0-1.75 / terms cards 1.8-5.75 / 20 NOV struck -> PAUSED 5.8-9.25 / status 9.3-11.75 / tips cards 11.8-16.75 / logo + CTA 16.8-20 |

**Captions:** none

## Commands

```
ffmpeg -y -hide_banner -loglevel error -stream_loop -1 -ss 0.0 -i raw/music_comp.wav -filter_complex [0:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=20.500,volume=0.0dB[mu];[mu]anull[mixed];[mixed]atrim=duration=20.000,apad=whole_dur=20.000,afade=t=in:d=0.3,afade=t=out:st=19.700:d=0.3[aout] -map [aout] -c:a pcm_s16le -ar 48000 work/mix_final.wav
ffmpeg -y -hide_banner -loglevel error -ss 0.0 -t 20.0 -i raw/01_scene.mp4 -i work/mix_final.wav -filter_complex [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,trim=end_frame=600,setpts=PTS-STARTPTS[v0];[v0]concat=n=1:v=1:a=0[vcat] -map [vcat] -map 1:a -af loudnorm=I=-14.0:TP=-1.5:LRA=11:measured_I=-18.92:measured_TP=-4.06:measured_LRA=3.90:measured_thresh=-28.92:offset=0.17:linear=true,aresample=192000,alimiter=limit=0.75:level=disabled:attack=1:release=40,aresample=48000 -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 -g 60 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 20.000 export/final.mp4
```
