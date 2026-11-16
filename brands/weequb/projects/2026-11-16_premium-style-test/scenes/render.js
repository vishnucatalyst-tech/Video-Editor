// Render premium.html to raw/01_premium.mp4 (1080x1920, 30 fps, 5.5 s incl. handle).
// Usage (repo root): node brands/weequb/projects/2026-11-16_premium-style-test/scenes/render.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const FPS = 30, SECONDS = 5.5;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'premium.html'));
  await page.evaluate(() => window.ready);
  const raw = path.join(__dirname, '..', 'raw');
  require('fs').mkdirSync(raw, { recursive: true });
  const out = path.join(raw, '01_premium.mp4');
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg',
    '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(SECONDS * FPS); f++) {
    await page.evaluate(t => window.setT(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  await browser.close();
  console.log('✓', out);
})().catch(e => { console.error(e); process.exit(1); });
