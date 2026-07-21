import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/database';
import { User } from '../models/User';
import { Photo } from '../models/Photo';

dotenv.config();

// Stock photos of black males and females from various free image sources
// Using picsum.photos with specific seeds for consistent images
const malePhotos = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1548372290-8d01b6c8e78c?w=400&h=400&fit=crop&crop=face',
];

const femalePhotos = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face',
];

let malePhotoIndex = 0;
let femalePhotoIndex = 0;

const getNextPhotos = (gender: string): string[] => {
  if (gender === 'male') {
    const photos = [
      malePhotos[malePhotoIndex % malePhotos.length],
      malePhotos[(malePhotoIndex + 1) % malePhotos.length],
    ];
    malePhotoIndex += 2;
    return photos;
  } else {
    const photos = [
      femalePhotos[femalePhotoIndex % femalePhotos.length],
      femalePhotos[(femalePhotoIndex + 1) % femalePhotos.length],
    ];
    femalePhotoIndex += 2;
    return photos;
  }
};

const addPhotosToUsers = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find users that have @example.com emails (our seeded test users)
    const testUsers = await User.find({ email: { $regex: /@example\.com$/ } });

    if (testUsers.length === 0) {
      console.log('No test users found. Run seedNearbyUsers.ts first.');
      await closeDB();
      return;
    }

    console.log(`Found ${testUsers.length} test users\n`);

    let photosAdded = 0;

    for (const user of testUsers) {
      // Check if user already has photos
      const existingPhotos = await Photo.countDocuments({ userId: user._id });
      
      if (existingPhotos >= 2) {
        console.log(`${user.fullName} already has ${existingPhotos} photos, skipping...`);
        continue;
      }

      const photoUrls = getNextPhotos(user.gender || 'male');
      
      // Delete any existing photos first
      if (existingPhotos > 0) {
        await Photo.deleteMany({ userId: user._id });
      }

      // Create 2 photos for this user
      for (let i = 0; i < photoUrls.length; i++) {
        await Photo.create({
          userId: user._id,
          url: photoUrls[i],
          order: i,
        });
      }

      photosAdded += 2;
      console.log(`Added 2 photos for ${user.fullName} (${user.gender})`);
    }

    console.log(`\n✅ Done! Added ${photosAdded} photos total.`);

    await closeDB();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error adding photos:', error);
    await closeDB();
    process.exit(1);
  }
};

addPhotosToUsers();
