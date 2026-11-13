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
/** A place's feature ID (`0x…:0x…`) in a Maps link or page URL. */
const FEATURE_ID_IN_URL = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i;

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

/**
 * The organic results list for a search, top MAX_TRACKED_RANK, ads left out. When Google
 * answers with a single business instead of a list, that business is the only result.
 */
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

  if ((await waitForResults(page)) === 'singlePlace') return [await readSinglePlace(page)];
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
      return placeId ? [{ placeId, name: card.name, ...parseRating(card.ratingLabel) }] : [];
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

/**
 * Waits for the results: a list, or a single business. Google skips the list and opens one
 * profile when a search clearly points at that business (e.g. "Issaquah Electrician" near
 * the business). Neither within the timeout is a failed check, never "not found".
 */
async function waitForResults(page: Page): Promise<'list' | 'singlePlace'> {
  try {
    // Runs in the page; a string, since this server code isn't type-checked against the DOM.
    await page.waitForFunction(
      `document.querySelector(${JSON.stringify(RESULT_LINKS)}) !== null || location.pathname.includes('/maps/place/')`,
      null,
      { timeout: FEED_TIMEOUT_MS },
    );
  } catch {
    throw new Error(`No results on the page (${page.url().slice(0, 120)})`);
  }
  return (await page.locator(RESULT_LINKS).count()) > 0 ? 'list' : 'singlePlace';
}

/** The one business Google opened instead of a list. It's all the searcher sees: position 1. */
async function readSinglePlace(page: Page): Promise<MapsListing> {
  const featureId = decodeURIComponent(page.url()).match(FEATURE_ID_IN_URL)?.[1];
  if (!featureId) throw new Error(`Couldn't identify the business on ${page.url().slice(0, 120)}`);

  const panel = page.locator('div[role="main"]').filter({ has: page.locator('h1') }).first();
  await panel.locator('h1').filter({ hasText: /\S/ }).first().waitFor({ timeout: FEED_TIMEOUT_MS });
  // The rating appears a moment after the name; a business without reviews never shows one.
  await panel.locator('[aria-label$="reviews" i], [aria-label$="review" i]').first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  const { name, labels } = await panel.evaluate((el) => ({
    name: el.querySelector('h1')?.textContent ?? '',
    labels: [...el.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? ''),
  }));
  return {
    position: 1,
    placeId: placeIdFromFeatureId(featureId),
    name: name.trim(),
    ...parseProfileRating(labels),
  };
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
 * The Place ID (`ChIJ…`) sits after `!19s` in the result link. When a link has none, it's
 * derived from the feature ID (`0x…:0x…`, after `!1s`).
 */
function placeIdFromHref(href: string): string | null {
  const decoded = decodeURIComponent(href);
  const placeId = decoded.match(/!19s(ChIJ[^!?&]+)/)?.[1];
  if (placeId) return placeId;
  const featureId = decoded.match(FEATURE_ID_IN_URL)?.[1];
  return featureId ? placeIdFromFeatureId(featureId) : null;
}

/**
 * A `ChIJ…` Place ID is the feature ID's two 64-bit numbers in a tiny protobuf message
 * (field 1 and 2, fixed64), base64url-encoded. Converting means every result is stored by
 * Place ID, so it always matches the tracked business's Place ID, however Google linked it.
 */
function placeIdFromFeatureId(featureId: string): string {
  const [first, second] = featureId.split(':').map((hex) => BigInt(hex));
  const bytes = Buffer.alloc(20);
  bytes.set([0x0a, 0x12, 0x09], 0); // message of 18 bytes; field 1 (fixed64) follows
  bytes.writeBigUInt64LE(first, 3);
  bytes[11] = 0x11; // field 2 (fixed64)
  bytes.writeBigUInt64LE(second, 12);
  return bytes.toString('base64url');
}

/**
 * Google rating and review count from a business profile's labels ("4.9 stars ", then
 * "226 reviews"): the profile's own Google reviews, as in the results list.
 */
function parseProfileRating(labels: string[]) {
  const rating = labels.map((l) => l.match(/^\s*([\d.]+)\s+stars?\s*$/i)).find(Boolean);
  const reviews = labels.map((l) => l.match(/^\s*([\d,]+)\s+reviews?\s*$/i)).find(Boolean);
  return {
    rating: rating ? Number(rating[1]) : null,
    reviewCount: reviews ? Number(reviews[1].replace(/,/g, '')) : null,
  };
}

/**
 * Google rating and Google review count of the business profile, read only from the card's
 * stars label ("4.7 stars 151 Reviews"). That label matched each profile's own Google review
 * count in tests (2026-11-13); third-party "reviews from the web" are never part of it.
 * Without the label we store nothing rather than guess from other numbers in the card.
 */
function parseRating(ratingLabel: string) {
  const match = ratingLabel.match(/^\s*([\d.]+)\s+stars?\s+([\d,]+)\s+reviews?\s*$/i);
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
