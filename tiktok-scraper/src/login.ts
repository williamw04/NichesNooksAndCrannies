import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function login() {
  console.log('Opening browser for manual TikTok login...\n');
  console.log('Steps:');
  console.log('1. Log into your TikTok account in the browser window');
  console.log('2. Once logged in, press Enter in this terminal to save cookies');
  console.log('3. The browser will close and cookies will be saved\n');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();

  await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded' });

  console.log('Browser opened. Waiting for you to log in...\n');

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  const cookies = await context.cookies();
  
  const sessionCookies = cookies.filter(c => 
    c.domain.includes('tiktok.com') && 
    ['sessionid', 'sid_tt', 'sid_guard', 'uid_tt', 'odin_tt'].some(name => 
      c.name.toLowerCase().includes(name.toLowerCase())
    )
  );

  const allTiktokCookies = cookies.filter(c => c.domain.includes('tiktok.com'));

  const cookiesDir = path.join(process.cwd(), 'auth');
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }

  const cookiesPath = path.join(cookiesDir, 'tiktok-cookies.json');
  fs.writeFileSync(cookiesPath, JSON.stringify(allTiktokCookies, null, 2));

  console.log(`\n✅ Saved ${allTiktokCookies.length} cookies to: ${cookiesPath}`);
  console.log(`   Session cookies found: ${sessionCookies.length}`);

  if (sessionCookies.length === 0) {
    console.log('\n⚠️  Warning: No session cookies detected. You may not be fully logged in.');
    console.log('   Try logging in again and make sure you see your profile.');
  } else {
    console.log('\n✅ Login successful! You can now run the scraper.');
    console.log('   Run: npm run scrape -- --input test-input.json');
  }

  await browser.close();
}

login().catch(console.error);