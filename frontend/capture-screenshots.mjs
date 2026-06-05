#!/usr/bin/env node

/**
 * Aurora Screenshot Capture Script
 *
 * Prerequisites:
 *   1. Backend running:  cd backend && source venv/bin/activate && python run.py
 *   2. Frontend running: cd frontend && npm run dev
 *   3. Run:               cd frontend && node capture-screenshots.mjs
 *
 * Screenshots are saved to ../docs/screenshots/
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1280, height: 720 };

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function screenshot(page, name) {
  const filepath = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath });
  console.log(`  ✓ ${name}.png`);
}

// Click a visible sidebar nav item by label text
async function clickNav(page, label) {
  // Target only visible buttons (desktop sidebar is visible, mobile drawer is hidden)
  const btn = page.locator(`button:visible:has-text("${label}")`).first();
  await btn.click();
  await page.waitForTimeout(600);
}

async function main() {
  console.log('🎬 Aurora Screenshot Capture\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-webgl'],
  });

  try {
    // ── Context 1: App with library data ──────────────────────────
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
    });

    console.log(`Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. All Songs
    console.log('📸 01-all-songs');
    await clickNav(page, 'All Songs');
    await page.waitForSelector('h1:has-text("All Songs")', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await screenshot(page, '01-all-songs');

    // 2. Mix / Filter
    console.log('📸 02-mix-filter');
    await clickNav(page, 'Mix');
    // Type a query into the filter input
    const filterInput = page.locator('textarea[placeholder*="tag:"]').first();
    if (await filterInput.isVisible().catch(() => false)) {
      await filterInput.fill('anime');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }
    await screenshot(page, '02-mix-filter');

    // 3. Folders
    console.log('📸 03-folders');
    await clickNav(page, 'Folders');
    await page.waitForTimeout(500);
    await screenshot(page, '03-folders');

    // 4. Playlist detail — click first playlist in sidebar
    console.log('📸 04-playlist-detail');
    // Click a visible playlist button (skip nav items)
    const visibleBtns = page.locator('button:visible');
    const allTexts = await visibleBtns.allTextContents();
    let playlistClicked = false;
    for (const text of allTexts) {
      const skipWords = ['All Songs', 'Mix', 'Folders', 'New Playlist', 'Scan Folder',
        'Add Song', 'Import', 'Settings', 'About', 'Aurora', 'Search', 'Clear'];
      const t = text.trim();
      if (t && !skipWords.includes(t) && t.length > 0) {
        // This is likely a playlist name
        console.log(`  Clicking: "${t}"`);
        await page.locator(`button:visible:has-text("${t}")`).first().click();
        await page.waitForTimeout(1000);
        playlistClicked = true;
        break;
      }
    }
    if (!playlistClicked) {
      console.log('  No playlists found');
    }
    await screenshot(page, '04-playlist-detail');

    // 5. Queue panel
    console.log('📸 05-queue-panel');
    // The queue button has ListMusic icon; look for it in the player bar
    const queueBtn = page.locator('[aria-label*="Queue"], button:has(svg.lucide-list-music)').first();
    if (await queueBtn.isVisible().catch(() => false)) {
      await queueBtn.click();
    } else {
      // Fallback: click the ListMusic icon area by looking for the SVG
      await page.locator('svg.lucide-list-music').first().click().catch(() => {});
    }
    await page.waitForTimeout(700);
    await screenshot(page, '05-queue-panel');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 6. Settings
    console.log('📸 06-settings');
    await clickNav(page, 'Settings');
    await page.waitForTimeout(500);
    await screenshot(page, '06-settings');

    // 7. Keyboard shortcuts
    console.log('📸 07-keyboard-shortcuts');
    await page.keyboard.press('?');
    await page.waitForTimeout(600);
    await page.waitForSelector('text=Keyboard Shortcuts', { timeout: 3000 }).catch(() => {});
    await screenshot(page, '07-keyboard-shortcuts');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await ctx.close();

    // ── Context 2: Welcome screen (no data) ────────────────────────
    console.log('📸 08-welcome');
    const ctx2 = await browser.newContext({ viewport: VIEWPORT });
    const page2 = await ctx2.newPage();
    await page2.goto(BASE_URL);
    await page2.evaluate(() => localStorage.clear());
    await page2.reload({ waitUntil: 'networkidle' });
    await page2.waitForTimeout(2000);
    await page2.waitForSelector('text=Welcome', { timeout: 5000 }).catch(() => {
      console.log('  (Welcome overlay may not appear — backend has songs loaded)');
    });
    await screenshot(page2, '08-welcome');
    await ctx2.close();

    console.log('\n✅ Done! Screenshots saved to:');
    console.log(`   ${OUTPUT_DIR}/`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try {
      const pages = browser.contexts()[0]?.pages();
      if (pages?.length) await pages[0].screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png') });
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
