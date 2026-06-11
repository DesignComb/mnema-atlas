// Generates public/og.png (1200×630) for link unfurls (audit A2).
// Run: node scripts/generate-og.mjs  (uses the e2e Playwright install)
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png')

// Self-contained HTML mirroring the app's calm paper aesthetic + space hues.
// System serif keeps it network-free; the composition matches the landing hero.
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: oklch(0.994 0.003 95);
    font-family: Georgia, 'Times New Roman', serif;
    color: oklch(0.27 0.012 60);
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 96px;
    position: relative;
  }
  .dots {
    position: absolute; inset: 0;
    background-image: radial-gradient(oklch(0.9 0.004 75) 1.5px, transparent 1.5px);
    background-size: 26px 26px;
    -webkit-mask-image: radial-gradient(ellipse at top right, black, transparent 65%);
  }
  .brand { display: flex; align-items: center; gap: 16px; }
  .dot { width: 18px; height: 18px; border-radius: 999px; background: oklch(0.58 0.13 250); }
  .word { font-size: 44px; font-weight: 600; letter-spacing: -0.01em; }
  h1 { margin-top: 44px; font-size: 76px; line-height: 1.12; letter-spacing: -0.015em; font-weight: 600; }
  p { margin-top: 28px; font-size: 30px; line-height: 1.45; color: oklch(0.52 0.012 65); font-family: 'Segoe UI', system-ui, sans-serif; max-width: 880px; }
  .spaces { position: absolute; left: 96px; bottom: 64px; display: flex; gap: 28px; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 22px; color: oklch(0.45 0.012 65); }
  .spaces span { display: inline-flex; align-items: center; gap: 10px; }
  .spaces i { width: 12px; height: 12px; border-radius: 999px; display: inline-block; }
</style></head>
<body>
  <div class="dots"></div>
  <div class="brand"><span class="dot"></span><span class="word">Mnema</span></div>
  <h1>Your AI. Your memory.<br>One quiet workspace.</h1>
  <p>Connect the assistant you already use — it fills your notes, trips, tasks, money, health &amp; kitchen for you.</p>
  <div class="spaces">
    <span><i style="background:oklch(0.58 0.13 250)"></i>Study</span>
    <span><i style="background:oklch(0.6 0.1 195)"></i>Travel</span>
    <span><i style="background:oklch(0.55 0.16 300)"></i>Tempo</span>
    <span><i style="background:oklch(0.72 0.14 83)"></i>Money</span>
    <span><i style="background:oklch(0.58 0.12 150)"></i>Health</span>
    <span><i style="background:oklch(0.64 0.14 50)"></i>Kitchen</span>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html)
await page.screenshot({ path: out })
await browser.close()
console.log('wrote', out)
