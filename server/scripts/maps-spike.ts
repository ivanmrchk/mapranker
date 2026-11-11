// Proof-of-concept: scrape Google Maps search results for a keyword at a few
// lat/lng points and print the ordered results with their IDs.
// Usage: npx tsx scripts/maps-spike.ts "electrician" 30.2672,-97.7431 30.30,-97.70
import { chromium, type Page } from 'playwright';

const SCREENSHOT_DIR = process.env.SPIKE_OUT ?? '.';

interface MapsResult {
  position: number;
  name: string;
  sponsored: boolean;
  featureId: string | null;
  placeId: string | null;
  href: string;
}

function parseIds(href: string) {
  const decoded = decodeURIComponent(href);
  return {
    featureId: decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1] ?? null,
    placeId: decoded.match(/!19s(ChIJ[^!?&]+)/)?.[1] ?? null,
  };
}

async function scrollFeed(page: Page, want: number) {
  for (let i = 0; i < 8; i++) {
    const count = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
    if (count >= want) return;
    await page.locator('div[role="feed"]').evaluate((el) => el.scrollBy(0, el.scrollHeight));
    await page.waitForTimeout(1200 + Math.random() * 800);
    const end = await page.getByText("You've reached the end of the list").count();
    if (end) return;
  }
}

async function search(page: Page, keyword: string, lat: number, lng: number, tag: string) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lng},15z?hl=en${process.env.SPIKE_PARAMS ? `&${process.env.SPIKE_PARAMS}` : ''}`;
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  if (page.url().includes('consent.google.com')) {
    await page.getByRole('button', { name: /accept all/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  if (page.url().includes('/sorry/')) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/spike-${tag}-captcha.png` });
    return { blocked: true as const, url: page.url() };
  }

  try {
    await page.waitForSelector('div[role="feed"] a[href*="/maps/place/"]', { timeout: 20000 });
  } catch {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/spike-${tag}-nofeed.png` });
    return { blocked: false as const, error: 'no results feed', finalUrl: page.url() };
  }
  await scrollFeed(page, 20);

  const raw = await page.$$eval('div[role="feed"] a[href*="/maps/place/"]', (links) =>
    links.map((a) => {
      const card = a.closest('div[role="article"]') ?? a.parentElement;
      const text = card?.textContent ?? '';
      return {
        name: a.getAttribute('aria-label') ?? '',
        href: a.getAttribute('href') ?? '',
        sponsored: /\bSponsored\b/.test(text),
      };
    }),
  );

  const results: MapsResult[] = raw.map((r, i) => ({
    position: i + 1,
    name: r.name,
    sponsored: r.sponsored,
    href: r.href,
    ...parseIds(r.href),
  }));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/spike-${tag}.png` });
  return { blocked: false as const, ms: Date.now() - started, results };
}

async function main() {
  const [keyword, ...points] = process.argv.slice(2);
  if (!keyword || points.length === 0) throw new Error('usage: maps-spike.ts KEYWORD LAT,LNG [...]');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  for (const [i, point] of points.entries()) {
    const [lat, lng] = point.split(',').map(Number);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: lat, longitude: lng });
    const out = await search(page, keyword, lat, lng, `p${i + 1}`);
    console.log(`\n=== pin ${i + 1} @ ${lat},${lng}`);
    if ('results' in out && out.results) {
      console.log(`${out.results.length} results in ${out.ms} ms`);
      for (const r of out.results) {
        console.log(
          `${String(r.position).padStart(2)}. ${r.sponsored ? '[AD] ' : ''}${r.name}  | fid=${r.featureId} | pid=${r.placeId}`,
        );
      }
    } else {
      console.log(JSON.stringify(out));
    }
    if (i < points.length - 1) await page.waitForTimeout(4000 + Math.random() * 3000);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
