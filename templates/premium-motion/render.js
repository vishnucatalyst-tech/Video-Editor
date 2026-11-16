// Render a premium-motion scene page (it must expose window.setT(t) and window.ready) to an mp4.
// Usage (repo root): node templates/premium-motion/render.js <scene.html> <seconds> <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const FPS = 30;
(async () => {
  const [html, seconds, out] = process.argv.slice(2);
  if (!html || !seconds || !out) { console.error('usage: render.js <scene.html> <seconds> <out.mp4>'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => window.ready);
  require('fs').mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg',
    '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-r', String(FPS), path.resolve(out)], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(Number(seconds) * FPS); f++) {
    await page.evaluate(t => window.setT(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  await browser.close();
  console.log('✓', out);
})().catch(e => { console.error(e); process.exit(1); });
