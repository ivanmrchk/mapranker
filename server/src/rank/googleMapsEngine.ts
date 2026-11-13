import { chromium, type Browser, type Page } from 'playwright';
import {
  MAX_TRACKED_RANK,
  RankEngineBlockedError,
  type MapsListing,
  type RankCheckInput,
  type RankEngine,
  type RankSession,
} from './engine.js';

/**
 * Reads Google Maps search results with a headless browser, the way a US searcher at the
 * pin would see them. One browser per session; a polite random pause between searches.
 */
export const googleMapsEngine: RankEngine = {
  name: 'google',
  async startSession() {
    const browser = await chromium.launch({ headless: true });
    try {
      return await openSession(browser);
    } catch (err) {
      await browser.close();
      throw err;
    }
  },
};

const PAUSE_BETWEEN_SEARCHES_MS = { min: 4000, max: 7000 } as const;
const PAGE_LOAD_TIMEOUT_MS = 45_000;
const FEED_TIMEOUT_MS = 20_000;
const RESULT_LINKS = 'div[role="feed"] a[href*="/maps/place/"]';

async function openSession(browser: Browser): Promise<RankSession> {
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  });
  await context.grantPermissions(['geolocation']);
  const page = await context.newPage();
  let searchesDone = 0;

  return {
    async check(input) {
      if (searchesDone > 0) await page.waitForTimeout(randomBetween(PAUSE_BETWEEN_SEARCHES_MS));
      searchesDone++;
      await context.setGeolocation({ latitude: input.lat, longitude: input.lng });
      const listings = await searchMaps(page, input);
      const rank = listings.find((l) => l.placeId === input.placeId)?.position ?? null;
      return { rank, listings };
    },
    async close() {
      await browser.close();
    },
  };
}

/** The organic results list for a search, top MAX_TRACKED_RANK, ads left out. */
async function searchMaps(page: Page, { keyword, lat, lng }: RankCheckInput): Promise<MapsListing[]> {
  await page.goto(searchUrl(keyword, lat, lng), {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  if (page.url().includes('consent.google.com')) {
    await page.getByRole('button', { name: /accept all/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  if (page.url().includes('/sorry/')) {
    throw new RankEngineBlockedError('Google asked for a CAPTCHA');
  }

  try {
    await page.waitForSelector(RESULT_LINKS, { timeout: FEED_TIMEOUT_MS });
  } catch {
    // No list means we can't tell where the business ranks; that's a failed check, never
    // "not found".
    throw new Error(`No results list on the page (${page.url().slice(0, 120)})`);
  }
  await loadEnoughResults(page);

  const cards = await page.$$eval(RESULT_LINKS, (links) =>
    links.map((link) => {
      // The link overlays the card; its parent holds the visible text (name, rating, "Sponsored").
      const card = link.parentElement;
      return {
        name: link.getAttribute('aria-label') ?? '',
        href: link.getAttribute('href') ?? '',
        ratingLabel:
          card?.querySelector('[role="img"][aria-label*="star" i]')?.getAttribute('aria-label') ?? '',
        text: card?.textContent ?? '',
      };
    }),
  );

  return cards
    .filter((card) => !isSponsored(card.text))
    .flatMap((card) => {
      const placeId = placeIdFromHref(card.href);
      return placeId ? [{ placeId, name: card.name, ...parseRating(card) }] : [];
    })
    .filter(firstOccurrenceOfPlace())
    .slice(0, MAX_TRACKED_RANK)
    .map((listing, i) => ({ position: i + 1, ...listing }));
}

function searchUrl(keyword: string, lat: number, lng: number): string {
  // hl/gl pin the language and country, so results don't depend on this machine's IP.
  // The pin panel links to the same URL (src/lib/mapsUrl.ts): change both together.
  return `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lng},15z?hl=en&gl=us`;
}

/** The list shows ~20 results at first; scroll it until there are enough organic ones or it ends. */
async function loadEnoughResults(page: Page) {
  const feed = page.locator('div[role="feed"]');
  for (let attempt = 0; attempt < 6; attempt++) {
    const organicCount = await page.$$eval(
      RESULT_LINKS,
      (links) => links.filter((link) => !/\bSponsored\b/.test(link.parentElement?.textContent ?? '')).length,
    );
    if (organicCount >= MAX_TRACKED_RANK) return;
    if (await page.getByText("You've reached the end of the list").count()) return;
    await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
    await page.waitForTimeout(randomBetween({ min: 1200, max: 2000 }));
  }
}

function isSponsored(cardText: string): boolean {
  return /\bSponsored\b/.test(cardText);
}

/**
 * The Place ID (`ChIJ…`) sits after `!19s` in the result link. When a link has none, the
 * feature ID (`0x…:0x…`, after `!1s`) still identifies the place consistently between scans.
 */
function placeIdFromHref(href: string): string | null {
  const decoded = decodeURIComponent(href);
  return (
    decoded.match(/!19s(ChIJ[^!?&]+)/)?.[1] ??
    decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1] ??
    null
  );
}

/** Rating and review count, from the stars label ("4.7 stars 151 Reviews") or the text ("4.7(151)"). */
function parseRating({ ratingLabel, text }: { ratingLabel: string; text: string }) {
  const fromLabel = ratingLabel.match(/([\d.]+)\s+stars?\s+([\d,]+)\s+reviews?/i);
  const fromText = text.match(/(\d\.\d)\s*\(([\d,]+)\)/);
  const match = fromLabel ?? fromText;
  if (!match) return { rating: null, reviewCount: null };
  return { rating: Number(match[1]), reviewCount: Number(match[2].replace(/,/g, '')) };
}

function firstOccurrenceOfPlace() {
  const seen = new Set<string>();
  return ({ placeId }: { placeId: string }) => {
    if (seen.has(placeId)) return false;
    seen.add(placeId);
    return true;
  };
}

function randomBetween({ min, max }: { readonly min: number; readonly max: number }): number {
  return min + Math.random() * (max - min);
}
