// Render the motion-graphics scenes in scenes.html to 1080x1920/30fps clips in ../raw/.
// Usage (from repo root): node brands/weequb/projects/2026-11-16_website-dev/scenes/render_scenes.js [scene ...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30;
const SCENES = { // name: seconds (script length + 0.5 s handle)
  loading: 2.0, bounce: 3.0, mobile: 3.5, reveal: 2.5,
  beforeafter: 3.5, score: 3.5, enquiries: 4.5, end: 3.5,
};
const order = Object.keys(SCENES);

(async () => {
  const pick = process.argv.slice(2).length ? process.argv.slice(2) : order;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const html = 'file://' + path.join(__dirname, 'scenes.html');
  const raw = path.join(__dirname, '..', 'raw');
  require('fs').mkdirSync(raw, { recursive: true });
  for (const name of pick) {
    const idx = String(order.indexOf(name) + 1).padStart(2, '0');
    const out = path.join(raw, `${idx}_${name}.mp4`);
    await page.goto(`${html}?scene=${name}`);
    await page.evaluate(() => window.ready);
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS),
      '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-r', String(FPS), out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(SCENES[name] * FPS);
    for (let f = 0; f < n; f++) {
      await page.evaluate(t => window.setT(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
    console.log(`✓ ${path.basename(out)} (${SCENES[name]} s)`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
