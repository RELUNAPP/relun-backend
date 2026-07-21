require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

async function run() {
  await mongoose.connect(process.env.DATABASE_URL);

  const db = mongoose.connection.db;

  const profiles = await db.collection('profiles').find({}, { projection: { location: 1 } }).toArray();

  let sanitizedCount = 0;
  for (const profile of profiles) {
    const location = profile.location;

    if (!location) {
      continue;
    }

    const hasPointType = location.type === 'Point';
    const coords = location.coordinates;
    const hasValidCoords =
      Array.isArray(coords) &&
      coords.length === 2 &&
      typeof coords[0] === 'number' &&
      Number.isFinite(coords[0]) &&
      typeof coords[1] === 'number' &&
      Number.isFinite(coords[1]);

    if (hasPointType && hasValidCoords) {
      continue;
    }

    const result = await db.collection('profiles').updateOne(
      { _id: profile._id },
      { $unset: { location: '' } }
    );

    if (result.modifiedCount > 0) {
      sanitizedCount += 1;
    }
  }

  console.log(`Sanitized profiles: ${sanitizedCount}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Failed to sanitize profiles:', error);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // ignore
  }
  process.exit(1);
});
