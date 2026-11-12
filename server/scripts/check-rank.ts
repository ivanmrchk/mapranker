// Runs the Google Maps engine for a keyword at one or more points and prints what it read,
// without touching the database. Handy for checking that the scraper still understands the
// page.
//
// Usage: npx tsx scripts/check-rank.ts "electrician" 30.2672,-97.7431 [30.30,-97.70 ...] [--place ChIJ...]
import { googleMapsEngine } from '../src/rank/googleMapsEngine.js';

async function main() {
  const args = process.argv.slice(2);
  const placeFlag = args.indexOf('--place');
  const placeId = placeFlag >= 0 ? args.splice(placeFlag, 2)[1] : '';
  const [keyword, ...points] = args;
  if (!keyword || points.length === 0) {
    throw new Error('usage: check-rank.ts KEYWORD LAT,LNG [...] [--place PLACE_ID]');
  }

  const session = await googleMapsEngine.startSession();
  try {
    for (const point of points) {
      const [lat, lng] = point.split(',').map(Number);
      const started = Date.now();
      const { rank, listings } = await session.check({ keyword, lat, lng, placeId, businessName: '' });
      console.log(`\n=== ${keyword} @ ${lat},${lng}: ${listings.length} results in ${Date.now() - started} ms`);
      if (placeId) console.log(`rank of ${placeId}: ${rank ?? '20+'}`);
      for (const l of listings) {
        const rating = l.rating === null ? '   –' : `★${l.rating.toFixed(1)}`;
        const reviews = l.reviewCount === null ? '' : ` (${l.reviewCount})`;
        console.log(`${String(l.position).padStart(2)}. ${rating}${reviews.padEnd(8)} ${l.name}  [${l.placeId}]`);
      }
    }
  } finally {
    await session.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
