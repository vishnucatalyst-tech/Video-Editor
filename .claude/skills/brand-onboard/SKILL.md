---
name: brand-onboard
description: "Onboard a brand: ask the brand questions and write BRAND.md (settings front matter + brand bible). Use for a new brand, or when a BRAND.md is missing, still has placeholders/DEMO values, or the brand's look changes."
argument-hint: "<brand>"
---
Onboard the brand `$ARGUMENTS`.

1. If `brands/<brand>/BRAND.md` doesn't exist, run `python tools/new_reel.py <brand> onboarding` to create the brand folder, then delete the empty `projects/*_onboarding` folder.
2. Ask the questions below in two or three short batches (not all at once), and wait for the answers:
   - Brand name, product or service, one-line positioning
   - Audience: age, language mix (Tamil / English / Tanglish, and which script for captions), platform behaviour
   - Tone: three adjectives
   - Colours: primary, secondary, accent, text (hex codes)
   - Fonts: headline, body, caption style (pop / karaoke / minimal). Ask for the font files to go in `assets/fonts/`.
   - Logo rules: placement, size, when it appears. The file goes in `assets/logo/`.
   - Music mood, tempo range, licensed sources
   - Pacing (fast / medium / calm) and average shot length
   - Hook formulas that worked, and hooks to avoid
   - Do / Don't list and legal disclaimers
   - Reference Reels: links, and what to borrow from each
3. Write the answers into `BRAND.md`: both the YAML front matter (the values the tools use) and the prose sections. Leave nothing as a placeholder. Where an answer is missing, write `TBD — ask <who>`.
4. Show a short summary and the front-matter values for confirmation.
