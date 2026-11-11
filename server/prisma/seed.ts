import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const address = '4821 Industrial Pkwy, Austin, TX 78744';
  // Demo business: the address is fictional, so its location is set directly.
  const location = { lat: 30.2692, lng: -97.7411 };

  await prisma.project.upsert({
    where: { id: 'surge-electrical' },
    update: { address, ...location },
    create: {
      id: 'surge-electrical',
      name: 'Surge Electrical',
      businessLabel: 'Surge Electrical',
      placeId: 'ChIJtbL9BIMX3okReiJx2ZTgIZc',
      address,
      ...location,
      status: 'Active',
      lastRun: new Date('2026-05-11'),
      avgRank: 3.8,
      avgRankTrend: 0.1,
      visibility: 9,
      visibilityTrend: null,
    },
  });

  const pins = [
    { id: 'surge-electrical-pin-1', lat: 30.2672, lng: -97.7431, lastCheckedAt: new Date('2026-05-11') },
    { id: 'surge-electrical-pin-2', lat: 30.2712, lng: -97.7391, lastCheckedAt: new Date('2026-05-11') },
    { id: 'surge-electrical-pin-3', lat: 30.2632, lng: -97.7471, lastCheckedAt: null },
    { id: 'surge-electrical-pin-4', lat: 30.2752, lng: -97.7351, lastCheckedAt: null },
  ];

  for (const pin of pins) {
    await prisma.pin.upsert({
      where: { id: pin.id },
      update: {},
      create: { ...pin, projectId: 'surge-electrical' },
    });
  }

  const rankSnapshots = [
    { id: 'surge-electrical-snap-1', date: new Date('2026-04-17'), avgRank: 4.3, visibility: 10 },
    { id: 'surge-electrical-snap-2', date: new Date('2026-04-18'), avgRank: 4.1, visibility: 13 },
    { id: 'surge-electrical-snap-3', date: new Date('2026-04-21'), avgRank: 4.0, visibility: 10 },
    { id: 'surge-electrical-snap-4', date: new Date('2026-04-24'), avgRank: 4.3, visibility: 9 },
    { id: 'surge-electrical-snap-5', date: new Date('2026-04-30'), avgRank: 3.7, visibility: 9.5 },
    { id: 'surge-electrical-snap-6', date: new Date('2026-05-11'), avgRank: 3.8, visibility: 9 },
  ];

  for (const snapshot of rankSnapshots) {
    await prisma.rankSnapshot.upsert({
      where: { id: snapshot.id },
      update: {},
      create: { ...snapshot, projectId: 'surge-electrical' },
    });
  }

  const keywords = [
    {
      id: 'surge-electrical-kw-1',
      text: 'electrician near me',
      avgRank: 2.9,
      visibility: 14,
      lastRun: new Date('2026-05-11'),
    },
    {
      id: 'surge-electrical-kw-2',
      text: 'emergency electrician',
      avgRank: 4.1,
      visibility: 7,
      lastRun: new Date('2026-05-11'),
    },
    {
      id: 'surge-electrical-kw-3',
      text: 'residential electrical repair',
      avgRank: 4.4,
      visibility: 6,
      lastRun: new Date('2026-05-11'),
    },
  ];

  for (const keyword of keywords) {
    await prisma.keyword.upsert({
      where: { id: keyword.id },
      update: {},
      create: { ...keyword, projectId: 'surge-electrical' },
    });
  }

  const competitors = [
    {
      id: 'surge-electrical-comp-1',
      name: 'Bright Spark Electric',
      placeId: 'ChIJ2QN1x3wX3okRoW8xO1kA9vE',
      avgRank: 2.1,
      visibility: 22,
      reviewCount: 184,
      reviewGrowthPerWeek: 3.2,
    },
    {
      id: 'surge-electrical-comp-2',
      name: 'Austin Volt Electricians',
      placeId: 'ChIJp1r4Z2sX3okRz1sVj0jH8bU',
      avgRank: 3.0,
      visibility: 15,
      reviewCount: 97,
      reviewGrowthPerWeek: 1.8,
    },
    {
      id: 'surge-electrical-comp-3',
      name: 'PowerPro Electrical Services',
      placeId: 'ChIJXd9wYkAX3okRt7GfM3nQeJk',
      avgRank: 5.2,
      visibility: 6,
      reviewCount: 52,
      reviewGrowthPerWeek: 0.6,
    },
    {
      id: 'surge-electrical-comp-4',
      name: 'CircuitWorks Electric',
      placeId: 'ChIJvS3kLpEX3okR4mAqzYtG1oM',
      avgRank: 6.8,
      visibility: 3,
      reviewCount: 21,
      reviewGrowthPerWeek: 0.2,
    },
  ];

  for (const competitor of competitors) {
    await prisma.competitor.upsert({
      where: { id: competitor.id },
      update: {},
      create: { ...competitor, projectId: 'surge-electrical' },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
