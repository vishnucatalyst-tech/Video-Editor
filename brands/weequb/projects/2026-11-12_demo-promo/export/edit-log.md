# Edit log — 2026-11-12_demo-promo

Rendered 2026-11-12 04:54

**Output:** 1080x1920 h264 30 fps, 16.50s, aac 48000 Hz, -14.7 LUFS, TP -1.2 dBTP, 25.2 MB

**Audio:** music music.wav (+0 dB, ducked 0 dB under 1 speech span(s)); 0.3 s fade in/out; two-pass loudnorm to -14 LUFS / -1.5 dBTP

## Cuts

| # | Timeline | Source | In → Out | Punch-in | Notes |
|---|---|---|---|---|---|
| 1 |   0.00 →   1.50 | 01_hook_zoom.mp4 | 1.00 → 2.50 | 1.00× | hook: fastest zoom + STOP SCROLLING! |
| 2 |   1.50 →   4.00 | 02_raw_clips.mp4 | 0.00 → 2.50 | 1.00× | landscape source → blurred-background fill |
| 3 |   4.00 →   6.00 | 01_hook_zoom.mp4 | 3.00 → 5.00 | 1.10× | punch-in on 'Scroll-stopping' |
| 4 |   6.00 →   8.50 | 04_beat_viz.mp4 | 0.50 → 3.00 | 1.00× | waveform of the track: cut on the beat |
| 5 |   8.50 →  11.00 | 05_phone_mockup.png | 0.00 → 2.50 | 1.00× | still with Ken Burns push |
| 6 |  11.00 →  13.50 | 03_gradient_flow.mp4 | 1.00 → 3.50 | 1.00× | brand colours; Tamil caption line |
| 7 |  13.50 →  16.50 | 06_end_card.png | 0.00 → 3.00 | 1.00× | logo end card + CTA |

**Captions:** work/captions.mov

## Commands

```
ffmpeg -y -hide_banner -loglevel error -stream_loop -1 -ss 0.0 -i raw/music.wav -filter_complex [0:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=17.000,volume=0.0dB,volume='pow(10,0.0*min(1,clip((t--0.100)/0.15,0,1)*clip((16.450-t)/0.15,0,1))/20)':eval=frame[mu];[mu]anull[mixed];[mixed]atrim=duration=16.500,apad=whole_dur=16.500,afade=t=in:d=0.3,afade=t=out:st=16.200:d=0.3[aout] -map [aout] -c:a pcm_s16le -ar 48000 work/mix_final.wav
ffmpeg -y -hide_banner -loglevel error -ss 1.0 -t 1.5 -i raw/01_hook_zoom.mp4 -ss 0.0 -t 2.5 -i raw/02_raw_clips.mp4 -ss 3.0 -t 2.0 -i raw/01_hook_zoom.mp4 -ss 0.5 -t 2.5 -i raw/04_beat_viz.mp4 -loop 1 -framerate 30 -t 2.5 -i raw/05_phone_mockup.png -ss 1.0 -t 2.5 -i raw/03_gradient_flow.mp4 -loop 1 -framerate 30 -t 3.0 -i raw/06_end_card.png -i work/captions.mov -i /home/user/Video-Editor/brands/weequb/assets/logo/logo.png -i work/mix_final.wav -filter_complex [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p,trim=duration=1.5,setpts=PTS-STARTPTS[v0];[1:v]split=2[bg1][fg1];[bg1]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=36,eq=brightness=-0.06:saturation=0.9[bgb1];[fg1]scale=1080:1920:force_original_aspect_ratio=decrease[fgs1];[bgb1][fgs1]overlay=(W-w)/2:(H-h)/2,fps=30,setsar=1,format=yuv420p,trim=duration=2.5,setpts=PTS-STARTPTS[v1];[2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,scale=ceil(1080*1.1/2)*2:ceil(1920*1.1/2)*2,crop=1080:1920,fps=30,setsar=1,format=yuv420p,trim=duration=2.0,setpts=PTS-STARTPTS[v2];[3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p,trim=duration=2.5,setpts=PTS-STARTPTS[v3];[4:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='1+0.06*on/75':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,fps=30,setsar=1,format=yuv420p,trim=duration=2.5,setpts=PTS-STARTPTS[v4];[5:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p,trim=duration=2.5,setpts=PTS-STARTPTS[v5];[6:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='1+0.06*on/90':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,fps=30,setsar=1,format=yuv420p,trim=duration=3.0,setpts=PTS-STARTPTS[v6];[v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0[vcat];[7:v]scale=1080:1920,format=yuva420p[capv];[vcat][capv]overlay=0:0:shortest=0:eof_action=pass[vcap];[8:v]scale=160:-1,format=rgba,colorchannelmixer=aa=0.9[lg];[vcap][lg]overlay=W-w-70:160:enable='between(t,0.00,13.50)'[vlogo] -map [vlogo] -map 9:a -af loudnorm=I=-14.0:TP=-1.5:LRA=11:measured_I=-16.46:measured_TP=-0.26:measured_LRA=0.40:measured_thresh=-26.48:offset=0.74:linear=true,aresample=192000,alimiter=limit=0.75:level=disabled:attack=1:release=40,aresample=48000 -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 -g 60 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 16.500 export/final.mp4
```
