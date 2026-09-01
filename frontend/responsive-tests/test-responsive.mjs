import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, 'screenshots');

if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const BREAKPOINTS = [
  { name: 'mobile-sm', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'mobile-lg', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

const results = [];
let browser;

function log(msg) {
  console.log(msg);
  results.push(msg);
}

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const docScrolls = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      const clips = style.overflowX === 'hidden' || style.overflowX === 'clip' || el.closest?.('[class*="overflow-hidden"]');
      if (el.scrollWidth > vw + 2 && el.children.length > 0 && !clips) {
        offenders.push({
          tag: el.tagName,
          cls: el.className?.toString?.()?.substring(0, 60) || '',
          sw: el.scrollWidth, vw
        });
      }
    });
    return { docScrolls, offenders: offenders.slice(0, 8) };
  });
}

async function checkTouchTargets(page) {
  return await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('a, button, [role="button"], input').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        small.push({ tag: el.tagName, txt: el.textContent?.substring(0, 25) || '', w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    return small.slice(0, 5);
  });
}

async function checkFonts(page) {
  return await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('p, span, a, li, td, label').forEach(el => {
      const sz = parseFloat(getComputedStyle(el).fontSize);
      if (sz > 0 && sz < 12) small.push({ tag: el.tagName, txt: el.textContent?.substring(0, 25) || '', sz });
    });
    return small.slice(0, 5);
  });
}

async function checkTextClip(page) {
  return await page.evaluate(() => {
    const clipped = [];
    document.querySelectorAll('a, button, span, p, h1, h2, h3, div').forEach(el => {
      const s = getComputedStyle(el);
      if (s.overflowX === 'hidden' || s.overflowY === 'hidden') return;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && el.childElementCount === 0) {
        clipped.push({ tag: el.tagName, txt: el.textContent?.substring(0, 35) || '', sw: el.scrollWidth, cw: el.clientWidth });
      }
    });
    return clipped.slice(0, 6);
  });
}

async function checkHeaderFit(page) {
  return await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const hr = header.getBoundingClientRect();
    const out = [];
    header.querySelectorAll('a, button, span').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        if (r.right > hr.right + 1 || r.left < hr.left - 1) out.push({ txt: el.textContent?.substring(0, 18) || '', l: Math.round(r.left), r: Math.round(r.right), hr: Math.round(hr.right) });
      }
    });
    const logoWrap = (() => {
      const a = header.querySelector('a');
      if (!a) return false;
      return a.scrollHeight > a.clientHeight + 2 && a.childElementCount > 0;
    })();
    return { out: out.slice(0, 5), logoWrap };
  });
}

async function checkButtons(page) {
  return await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a.btn, button.btn, .btn-xl, .btn-pill, .btn-primary, .btn-secondary').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 40) {
        out.push({ txt: el.textContent?.substring(0, 20) || '', cls: el.className.toString().substring(0, 50), h: Math.round(r.height) });
      }
    });
    return out.slice(0, 6);
  });
}

async function testBreakpoint(page, bp, pathname = '/') {
  await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 1 });
  await page.goto(BASE_URL + pathname, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const issues = [];
  const { docScrolls, offenders } = await checkOverflow(page);
  if (docScrolls) issues.push('DOC-LEVEL horizontal scroll detected');
  if (offenders.length > 0) issues.push('Unclipped overflow: ' + JSON.stringify(offenders));

  if (bp.width < 768) {
    const targets = await checkTouchTargets(page);
    if (targets.length > 0) issues.push(`Touch targets: ${JSON.stringify(targets)}`);
  }

  const fonts = await checkFonts(page);
  if (fonts.length > 0) issues.push(`Small fonts: ${JSON.stringify(fonts)}`);

  const clipped = await checkTextClip(page);
  if (clipped.length > 0) issues.push('Text clipped: ' + JSON.stringify(clipped));

  if (bp.width < 768) {
    const headerFit = await checkHeaderFit(page);
    if (headerFit && (headerFit.out.length > 0 || headerFit.logoWrap)) {
      issues.push('Header fit: ' + JSON.stringify(headerFit));
    }
  }

  const btns = await checkButtons(page);
  if (btns.length > 0) issues.push('Short buttons: ' + JSON.stringify(btns));

  const shot = path.join(SHOTS_DIR, (pathname === '/' ? 'landing' : 'login') + '-' + bp.name + '-' + bp.width + '.png');
  await page.screenshot({ path: shot, fullPage: true });

  return { bp: bp.name, width: bp.width, issues, shot };
}
async function main() {
  log('=== RESPONSIVE AUDIT START ===');
  try {
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
  } catch (e) {
    log('Failed to launch Edge: ' + e.message);
    process.exit(1);
  }

  const page = await browser.newPage();

  const PATHS = ['/', '/login'];

  for (const pathname of PATHS) {
    for (const bp of BREAKPOINTS) {
      log('\n--- ' + (pathname === '/' ? 'landing' : pathname) + ' @ ' + bp.name + ' (' + bp.width + 'x' + bp.height + ') ---');
      try {
        const r = await testBreakpoint(page, bp, pathname);
        if (r.issues.length === 0) {
          log('  OK - no issues');
        } else {
          r.issues.forEach(i => log('  ISSUE: ' + i));
        }
      } catch (e) {
        log('  ERROR: ' + e.message);
      }
    }
  }

  // Dark mode test
  log('\n--- Dark mode (mobile) ---');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SHOTS_DIR, 'mobile-dark.png'), fullPage: true });
  log('  Dark mode screenshot saved');

  // Interaction test
  log('\n--- Interactions ---');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const menuBtn = await page.$('button[aria-label*="menu" i], [data-testid="mobile-menu-btn"]');
  if (menuBtn) {
    await menuBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SHOTS_DIR, 'mobile-menu-open.png'), fullPage: false });
    log('  Mobile menu: opened OK');
  } else {
    log('  Mobile menu: NO button found');
  }

  const faqBtn = await page.$('button[aria-expanded]');
  if (faqBtn) {
    await faqBtn.click();
    await new Promise(r => setTimeout(r, 500));
    log('  FAQ accordion: click OK');
  }

  await browser.close();
  writeFileSync(path.join(SHOTS_DIR, 'report.txt'), results.join('\n'));
  log('\n=== AUDIT COMPLETE ===');
}

main().catch(e => { console.error(e); if (browser) browser.close(); process.exit(1); });

