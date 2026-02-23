import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User';
import { Profile } from '../models/Profile';
import { Photo } from '../models/Photo';
import { uploadImage, uploadMultipleImages, deleteImage } from '../services/cloudinary.service';
import { calculateDistance } from '../utils/helpers';

// Location update throttle settings
const LOCATION_UPDATE_DISTANCE_THRESHOLD = 0.5; // 500 meters in km
const LOCATION_UPDATE_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms

// Complete profile for first-time users
export const completeProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { fullName, dateOfBirth, gender, bio, segment, email, phone, latitude, longitude } =
      req.body;

    const user = await User.findById(req.user!.id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update user info
    if (fullName) user.fullName = fullName;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.gender = gender;

    // If user signed up with phone, they must provide email (and vice versa)
    if (email && !user.email) {
      // Check if email is already taken
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
      user.email = email;
    }

    if (phone && !user.phone) {
      // Check if phone is already taken
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        res.status(400).json({ error: 'Phone already in use' });
        return;
      }
      user.phone = phone;
    }

    await user.save();

    // Prepare profile update data
    const profileUpdateData: any = {
      bio,
      segment,
    };

    // Handle location conversion from latitude/longitude to GeoJSON
    if (latitude && longitude) {
      profileUpdateData.latitude = latitude;
      profileUpdateData.longitude = longitude;
      profileUpdateData.location = {
        type: 'Point',
        coordinates: [longitude, latitude], // [longitude, latitude]
      };
    }

    // Update profile
    const profile = await Profile.findOneAndUpdate(
      { userId: user._id },
      { $set: profileUpdateData },
      { new: true, upsert: true }
    );

    // Calculate completeness
    const requiredFields = ['bio', 'segment'];
    const userRequiredFields = ['fullName', 'dateOfBirth', 'gender', 'email', 'phone'];

    const filledProfileFields = requiredFields.filter((field) => profile.get(field));
    const filledUserFields = userRequiredFields.filter((field) => user.get(field));

    const totalFields = requiredFields.length + userRequiredFields.length;
    const filledFields = filledProfileFields.length + filledUserFields.length;

    const completenessScore = Math.round((filledFields / totalFields) * 100);
    const isComplete = completenessScore >= 80;

    profile.completenessScore = completenessScore;
    profile.isComplete = isComplete;
    await profile.save();

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
      },
      profile,
      isComplete,
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await Profile.findOne({ userId: req.user!.id });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const photos = await Photo.find({ userId: req.user!.id }).sort({ order: 1 });

    res.json({
      ...profile.toObject(),
      photos,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const updateData: any = { ...req.body };

    // Handle location conversion from latitude/longitude to GeoJSON
    if (updateData.latitude && updateData.longitude) {
      updateData.location = {
        type: 'Point',
        coordinates: [updateData.longitude, updateData.latitude], // [longitude, latitude]
      };
    } else if (
      updateData.location &&
      updateData.location.latitude &&
      updateData.location.longitude
    ) {
      updateData.location = {
        type: 'Point',
        coordinates: [updateData.location.longitude, updateData.location.latitude],
      };
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user!.id },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // Calculate completeness
    const requiredFields = ['bio', 'city', 'segment', 'lookingFor', 'interests'];
    const filledFields = requiredFields.filter((field) => profile.get(field));
    const completenessScore = Math.round((filledFields.length / requiredFields.length) * 100);
    const isComplete = completenessScore >= 80;

    profile.completenessScore = completenessScore;
    profile.isComplete = isComplete;
    await profile.save();

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const uploadPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Handle both single and multiple file uploads
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const photoCount = await Photo.countDocuments({ userId: req.user!.id });

    // Check if total photos would exceed limit
    if (photoCount + files.length > 6) {
      res.status(400).json({
        error: `Maximum 6 photos allowed. You have ${photoCount} photos, attempting to upload ${files.length} more.`,
      });
      return;
    }

    // Upload to Cloudinary - use different methods for single vs multiple
    let uploadResults;
    if (files.length === 1) {
      // Single file upload
      const result = await uploadImage(files[0].buffer, `relun/users/${req.user!.id}`);
      uploadResults = [result];
    } else {
      // Multiple files upload
      const buffers = files.map((file) => file.buffer);
      uploadResults = await uploadMultipleImages(buffers, `relun/users/${req.user!.id}`);
    }

    // Save all to database
    const uploadedPhotos = [];
    for (let i = 0; i < uploadResults.length; i++) {
      const result = uploadResults[i];
      const photo = await Photo.create({
        userId: req.user!.id,
        url: result.secureUrl,
        publicId: result.publicId,
        order: photoCount + i,
      });
      uploadedPhotos.push(photo);
    }

    // Upload all files to Cloudinary
    // const uploadedPhotos = [];

    // for (let i = 0; i < files.length; i++) {
    //   const file = files[i];

    //   // Upload to Cloudinary
    //   const uploadResult = await uploadImage(file.buffer, `relun/users/${req.user!.id}`);

    //   // Save to database
    //   const photo = await Photo.create({
    //     userId: req.user!.id,
    //     url: uploadResult.secureUrl,
    //     publicId: uploadResult.publicId,
    //     order: photoCount + i,
    //   });

    //   uploadedPhotos.push(photo);
    // }

    // Return single photo object if only one was uploaded, otherwise return array
    res.status(201).json(files.length === 1 ? uploadedPhotos[0] : uploadedPhotos);
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
};

export const deletePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { photoId } = req.params;

    const photo = await Photo.findOne({ _id: photoId, userId: req.user!.id });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    // Delete from Cloudinary if publicId exists
    if (photo.publicId) {
      await deleteImage(photo.publicId);
    }

    // Delete from database
    await Photo.deleteOne({ _id: photoId });

    // Reorder remaining photos
    const remainingPhotos = await Photo.find({ userId: req.user!.id }).sort({ order: 1 });

    for (let i = 0; i < remainingPhotos.length; i++) {
      remainingPhotos[i].order = i;
      await remainingPhotos[i].save();
    }

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('fullName dateOfBirth gender lastActive');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const profile = await Profile.findOne({ userId });
    const photos = await Photo.find({ userId }).sort({ order: 1 });

    res.json({
      user,
      profile,
      photos,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Get nearby users for discovery/feed
export const getNearbyUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { limit = 10, latitude, longitude } = req.query;
    const userId = req.user!.id;

    // Get current user's profile
    let currentProfile = await Profile.findOne({ userId });

    // Auto-update user location if coordinates are provided (with throttling)
    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);

      // Check if we should update location (throttle to reduce DB writes)
      let shouldUpdateLocation = true;

      if (currentProfile?.latitude && currentProfile?.longitude && currentProfile?.locationUpdatedAt) {
        const distanceMoved = calculateDistance(
          currentProfile.latitude,
          currentProfile.longitude,
          lat,
          lng
        );
        const timeSinceLastUpdate = Date.now() - new Date(currentProfile.locationUpdatedAt).getTime();

        // Only update if moved > 500m OR last update was > 5 minutes ago
        shouldUpdateLocation =
          distanceMoved > LOCATION_UPDATE_DISTANCE_THRESHOLD ||
          timeSinceLastUpdate > LOCATION_UPDATE_TIME_THRESHOLD;
      }

      if (shouldUpdateLocation) {
        const locationUpdate = {
          latitude: lat,
          longitude: lng,
          locationUpdatedAt: new Date(),
          location: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          },
        };

        currentProfile = await Profile.findOneAndUpdate(
          { userId },
          { $set: locationUpdate },
          { new: true, upsert: true }
        );
      }
    }

    const query: any = {
      _id: { $ne: userId },
      isActive: true,
    };

    // Add location-based filtering if available
    const hasLocation =
      currentProfile?.location?.coordinates ||
      (currentProfile?.latitude && currentProfile?.longitude);

    if (hasLocation && currentProfile) {
      let userLocation;

      // Use GeoJSON location if available, otherwise convert lat/lng
      if (currentProfile.location?.coordinates) {
        userLocation = currentProfile.location;
      } else if (currentProfile.latitude && currentProfile.longitude) {
        userLocation = {
          type: 'Point',
          coordinates: [currentProfile.longitude, currentProfile.latitude],
        };
      }

      // Find profile documents within the distance
      const nearbyProfileUserIds = await Profile.find({
        location: {
          $near: {
            $geometry: userLocation,
            $maxDistance: 500000, // 500km
          },
        },
      }).distinct('userId');

      if (!nearbyProfileUserIds || nearbyProfileUserIds.length === 0) {
        res.json({ users: [] });
        return;
      }

      // Filter out the current user
      const filteredNearbyIds = nearbyProfileUserIds.filter(
        (id) => id.toString() !== userId
      );

      if (filteredNearbyIds.length === 0) {
        res.json({ users: [] });
        return;
      }

      query._id = { $in: filteredNearbyIds };
    }

    const users = await User.find(query)
      .limit(Number(limit))
      .select('fullName dateOfBirth gender lastActive');

    // Get profiles and photos for each user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const profile = await Profile.findOne({ userId: user._id });
        const photos = await Photo.find({ userId: user._id }).sort({ order: 1 });
        return {
          user,
          profile,
          photos,
        };
      })
    );

    res.json({ users: usersWithProfiles });
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Failed to get nearby users' });
  }
};
