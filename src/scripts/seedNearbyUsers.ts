import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/database';
import { User } from '../models/User';
import { Profile } from '../models/Profile';

dotenv.config();

// Helper to generate random offset in km to lat/lng degrees
// 1 degree latitude ≈ 111km
// 1 degree longitude varies by latitude, but at equator ≈ 111km
const kmToLatDegrees = (km: number) => km / 111;
const kmToLngDegrees = (km: number, latitude: number) => km / (111 * Math.cos((latitude * Math.PI) / 180));

// Generate a random point within a certain km radius
const generateNearbyCoordinates = (
  baseLat: number,
  baseLng: number,
  minKm: number,
  maxKm: number
): { lat: number; lng: number } => {
  // Random distance between minKm and maxKm
  const distance = minKm + Math.random() * (maxKm - minKm);
  // Random angle in radians
  const angle = Math.random() * 2 * Math.PI;

  const latOffset = kmToLatDegrees(distance * Math.cos(angle));
  const lngOffset = kmToLngDegrees(distance * Math.sin(angle), baseLat);

  return {
    lat: baseLat + latOffset,
    lng: baseLng + lngOffset,
  };
};

// Sample data
const firstNames = {
  male: ['Chukwuemeka', 'Oluwaseun', 'Ademola', 'Ebuka', 'Tunde', 'Chibueze'],
  female: ['Chioma', 'Funmilayo', 'Adaeze', 'Blessing', 'Ngozi', 'Omotola'],
};

const lastNames = [
  'Okafor', 'Adeleke', 'Ibrahim', 'Oladipo', 'Nwachukwu', 'Adebayo',
  'Okeke', 'Balogun', 'Eze', 'Okonkwo', 'Udeh',
];

const occupations = [
  'Software Engineer', 'Marketing Manager', 'Teacher', 'Doctor',
  'Designer', 'Entrepreneur', 'Nurse', 'Accountant',
];

const interests = [
  'Music', 'Travel', 'Cooking', 'Sports', 'Reading', 'Movies',
  'Photography', 'Gaming', 'Fitness', 'Art', 'Dancing', 'Tech',
];

const getRandomItems = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateRandomDate = (minAge: number, maxAge: number): Date => {
  const now = new Date();
  const minYear = now.getFullYear() - maxAge;
  const maxYear = now.getFullYear() - minAge;
  const year = minYear + Math.floor(Math.random() * (maxYear - minYear));
  const month = Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return new Date(year, month, day);
};

const seedNearbyUsers = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find the target profile to get its location
    const targetProfileId = '6a5aaf9b4c06ced7ae8257c8';
    const targetProfile = await Profile.findById(targetProfileId);

    if (!targetProfile) {
      console.error(`Profile with ID ${targetProfileId} not found!`);
      console.log('Listing existing profiles...');
      const profiles = await Profile.find().limit(5);
      profiles.forEach((p) => {
        console.log(`- Profile ID: ${p._id}, UserId: ${p.userId}, Location: ${p.latitude}, ${p.longitude}`);
      });
      await closeDB();
      return;
    }

    const baseLat = targetProfile.latitude || 6.5244; // Default to Lagos if no location
    const baseLng = targetProfile.longitude || 3.3792;

    console.log(`Target profile location: ${baseLat}, ${baseLng}`);

    const createdUsers: { user: any; profile: any; distance: string }[] = [];

    // Create 10 users within 35km
    console.log('\nCreating 10 nearby users (within 35km)...');
    for (let i = 0; i < 10; i++) {
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const firstName = getRandomItem(firstNames[gender]);
      const lastName = getRandomItem(lastNames);
      const fullName = `${firstName} ${lastName}`;

      // Generate coordinates within 35km (between 1km and 35km)
      const { lat, lng } = generateNearbyCoordinates(baseLat, baseLng, 1, 35);

      const user = await User.create({
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        phone: `+234${Math.floor(700000000 + Math.random() * 99999999)}`,
        fullName,
        dateOfBirth: generateRandomDate(21, 40),
        gender,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        lastActive: new Date(),
      });

      const profile = await Profile.create({
        userId: user._id,
        bio: `Hi, I'm ${firstName}! Looking forward to meeting new people.`,
        occupation: getRandomItem(occupations),
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        latitude: lat,
        longitude: lng,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        locationUpdatedAt: new Date(),
        interests: getRandomItems(interests, 3 + Math.floor(Math.random() * 4)),
        segment: 'relationship',
        isVisible: true,
        isComplete: true,
        completenessScore: 80,
      });

      // Calculate approximate distance
      const distKm = Math.sqrt(
        Math.pow((lat - baseLat) * 111, 2) +
        Math.pow((lng - baseLng) * 111 * Math.cos((baseLat * Math.PI) / 180), 2)
      ).toFixed(1);

      createdUsers.push({ user, profile, distance: `${distKm}km` });
      console.log(`  Created: ${fullName} (${gender}) - ~${distKm}km away`);
    }

    // Create 1 user about 100km away
    console.log('\nCreating 1 distant user (~100km away)...');
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const firstName = getRandomItem(firstNames[gender]);
    const lastName = getRandomItem(lastNames);
    const fullName = `${firstName} ${lastName}`;

    // Generate coordinates ~100km away (between 95km and 105km)
    const { lat, lng } = generateNearbyCoordinates(baseLat, baseLng, 95, 105);

    const distantUser = await User.create({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.distant@example.com`,
      phone: `+234${Math.floor(700000000 + Math.random() * 99999999)}`,
      fullName,
      dateOfBirth: generateRandomDate(21, 40),
      gender,
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      lastActive: new Date(),
    });

    await Profile.create({
      userId: distantUser._id,
      bio: `Hi, I'm ${firstName}! I live far away but love to travel.`,
      occupation: getRandomItem(occupations),
      city: 'Ibadan',
      state: 'Oyo',
      country: 'Nigeria',
      latitude: lat,
      longitude: lng,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      locationUpdatedAt: new Date(),
      interests: getRandomItems(interests, 3 + Math.floor(Math.random() * 4)),
      segment: 'relationship',
      isVisible: true,
      isComplete: true,
      completenessScore: 80,
    });

    const distKm = Math.sqrt(
      Math.pow((lat - baseLat) * 111, 2) +
      Math.pow((lng - baseLng) * 111 * Math.cos((baseLat * Math.PI) / 180), 2)
    ).toFixed(1);

    console.log(`  Created: ${fullName} (${gender}) - ~${distKm}km away`);

    console.log('\n✅ Seeding complete!');
    console.log(`  - 10 nearby users created (within 35km)`);
    console.log(`  - 1 distant user created (~100km away)`);
    console.log(`\nNote: The distant user will NOT appear in discover results (35km limit)`);

    await closeDB();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Seeding error:', error);
    await closeDB();
    process.exit(1);
  }
};

seedNearbyUsers();
