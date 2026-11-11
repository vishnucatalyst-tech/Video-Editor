# Brands

One folder per brand, created by `/new-reel <brand> <topic>` or `/brand-onboard <brand>`:

```
<brand>/
  BRAND.md                 brand bible (front matter = settings the tools read)
  assets/logo/             logo.png (transparent)
  assets/fonts/            brand fonts (.ttf/.otf)
  assets/music/            brand-exclusive licensed music
  projects/
    YYYY-MM-DD_<topic>/
      raw/                 original footage, voiceover, images   (git-ignored)
      brief.md             the Creative Director prompt
      work/                cutlist.json/md, words.json, previews  (renders git-ignored)
      export/              final.mp4, cover.jpg, captions.srt, edit-log.md
```
