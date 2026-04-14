import { chromium, Browser, BrowserContext } from 'playwright';

export async function launchBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  `);

  return { browser, context };
}

export async function closeBrowser(browser: Browser, context: BrowserContext): Promise<void> {
  await context.close();
  await browser.close();
}

export async function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeText(page: import('playwright').Page, selector: string, timeoutMs: number = 3000): Promise<string> {
  try {
    return (await page.locator(selector).first().textContent({ timeout: timeoutMs }))?.trim() || '';
  } catch {
    return '';
  }
}

export async function safeAttr(page: import('playwright').Page, selector: string, attr: string, timeoutMs: number = 3000): Promise<string> {
  try {
    return (await page.locator(selector).first().getAttribute(attr, { timeout: timeoutMs })) || '';
  } catch {
    return '';
  }
}

export function parseNumber(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/[^0-9.KkMmBb]/g, '');
  const num = parseFloat(clean);
  if (text.toLowerCase().includes('k')) return Math.floor(num * 1000);
  if (text.toLowerCase().includes('m')) return Math.floor(num * 1000000);
  if (text.toLowerCase().includes('b')) return Math.floor(num * 1000000000);
  return Math.floor(num) || 0;
}

export function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.map((h) => h.replace('#', ''));
}

export function extractMentions(text: string): string[] {
  const mentions = text.match(/@\w+/g) || [];
  return mentions.map((m) => m.replace('@', ''));
}

export function parseVtt(vttText: string): string {
  const lines = vttText.split('\n');
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;
    textLines.push(trimmed);
  }
  return textLines.join(' ');
}

export function extractVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  if (match) return match[1];
  const match2 = url.match(/\/t\/([\w]+)/);
  if (match2) return match2[1];
  return Date.now().toString();
}
