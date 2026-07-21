import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User';
import { Profile } from '../models/Profile';
import { Photo } from '../models/Photo';
import { Like } from '../models/Like';
import { uploadImage, uploadMultipleImages } from '../services/cloudinary.service';
import { calculateDistance } from '../utils/helpers';
import {
  CompleteProfileRequest,
  ProfileUpdateData,
  CompleteProfileResponseDto,
  UserDto,
} from '../types';

// Location update throttle settings
const LOCATION_UPDATE_DISTANCE_THRESHOLD = 0.5; // 500 meters in km
const LOCATION_UPDATE_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms

const isLocationIndexError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: number; codeName?: string };
  return maybeError.code === 16755 || maybeError.codeName === 'Location16755';
};

const clearInvalidLocationForUser = async (userId: string | Types.ObjectId) => {
  const normalizedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  await Profile.collection.updateOne(
    {
      userId: normalizedUserId,
      location: { $exists: true },
      $or: [
        { 'location.type': { $exists: false } },
        { 'location.type': { $ne: 'Point' } },
        { 'location.coordinates.0': { $exists: false } },
        { 'location.coordinates.1': { $exists: false } },
        { 'location.coordinates.2': { $exists: true } },
      ],
    },
    {
      $unset: {
        location: '',
      },
    }
  );
};

// Complete profile for first-time users
export const completeProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      bio,
      segment,
      email,
      phone,
      latitude,
      longitude,
    }: CompleteProfileRequest = req.body;

    const user = await User.findById(req.user!.id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (fullName) user.fullName = fullName;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.gender = gender;

    // If user signed up with phone, they must provide email (and vice versa)
    if (email && !user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
      user.email = email;
    }

    if (phone && !user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        res.status(400).json({ error: 'Phone already in use' });
        return;
      }
      user.phone = phone;
    }

    await user.save();

    const profileUpdateData: ProfileUpdateData = {
      fullName,
      dateOfBirth,
      gender,
      bio,
      segment,
      email,
      phone,
      latitude,
      longitude,
    };

    if (latitude !== undefined && longitude !== undefined) {
      profileUpdateData.latitude = latitude;
      profileUpdateData.longitude = longitude;
      profileUpdateData.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    await clearInvalidLocationForUser(user._id);

    let profile;
    try {
      profile = await Profile.findOneAndUpdate(
        { userId: user._id },
        { $set: profileUpdateData },
        { new: true, upsert: true }
      );
    } catch (error) {
      if (!isLocationIndexError(error)) {
        throw error;
      }

      await Profile.collection.updateOne({ userId: user._id }, { $unset: { location: '' } });

      profile = await Profile.findOneAndUpdate(
        { userId: user._id },
        { $set: profileUpdateData },
        { new: true, upsert: true }
      );
    }

    // Calculate completeness
    const requiredFields = ['segment'];
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

    const userDto: UserDto = {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
    };

    const response: CompleteProfileResponseDto = {
      user: userDto,
      profile: profile.toObject() as unknown as Record<string, unknown>,
      isComplete,
    };

    res.json(response);
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

    const user = await User.findById(req.user!.id).select('fullName dateOfBirth gender email phone');

    const photos = await Photo.find({ userId: req.user!.id }).sort({ order: 1 });

    res.json({
      user,
      profile: profile.toObject(),
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

    const updateData: ProfileUpdateData = { ...req.body };

    if (typeof req.body.fullName === 'string') {
      const trimmedFullName = req.body.fullName.trim();

      if (trimmedFullName.length > 0) {
        await User.findByIdAndUpdate(req.user!.id, { fullName: trimmedFullName });
      }
    }

    // fullName belongs to User model, not Profile model
    delete updateData.fullName;

    // Handle location conversion from latitude/longitude to GeoJSON
    if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [updateData.longitude, updateData.latitude], // [longitude, latitude]
      };
    }

    await clearInvalidLocationForUser(req.user!.id);

    let profile;
    try {
      profile = await Profile.findOneAndUpdate(
        { userId: req.user!.id },
        { $set: updateData },
        { new: true, upsert: true }
      );
    } catch (error) {
      if (!isLocationIndexError(error)) {
        throw error;
      }

      await Profile.collection.updateOne(
        { userId: new Types.ObjectId(req.user!.id) },
        { $unset: { location: '' } }
      );

      profile = await Profile.findOneAndUpdate(
        { userId: req.user!.id },
        { $set: updateData },
        { new: true, upsert: true }
      );
    }

    // Calculate completeness
    const requiredFields = ['bio', 'city', 'segment', 'lookingFor', 'interests'];
    const filledFields = requiredFields.filter((field) => profile.get(field));
    const completenessScore = Math.round((filledFields.length / requiredFields.length) * 100);
    const isComplete = completenessScore >= 90;

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

export const replacePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { photoId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const existingPhoto = await Photo.findOne({ _id: photoId, userId: req.user!.id });

    if (!existingPhoto) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const uploadResult = await uploadImage(file.buffer, `relun/users/${req.user!.id}`);

    // if (existingPhoto.publicId) {
    //   await deleteImage(existingPhoto.publicId);
    // }

    existingPhoto.url = uploadResult.secureUrl;
    existingPhoto.publicId = uploadResult.publicId;
    await existingPhoto.save();

    res.json(existingPhoto);
  } catch (error) {
    console.error('Replace photo error:', error);
    res.status(500).json({ error: 'Failed to replace photo' });
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
    // if (photo.publicId) {
    //   await deleteImage(photo.publicId);
    // }

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

export const likeUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { targetUserId } = req.params;
    const userId = req.user!.id;

    if (userId === targetUserId) {
      res.status(400).json({ error: 'You cannot like yourself' });
      return;
    }

    const targetUser = await User.findOne({ _id: targetUserId, isActive: true });

    if (!targetUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    const [currentProfile, targetProfile] = await Promise.all([
      Profile.findOne({ userId }).select('segment'),
      Profile.findOne({ userId: targetUserId }).select('segment'),
    ]);

    if (
      currentProfile?.segment &&
      targetProfile?.segment &&
      currentProfile.segment !== targetProfile.segment
    ) {
      res.status(403).json({ error: 'You can only like users in the same segment' });
      return;
    }

    const existingLike = await Like.findOne({ userId, targetUserId });

    if (!existingLike) {
      await Like.create({ userId, targetUserId });
    }

    const reciprocalLikeExists = !!(await Like.exists({
      userId: targetUserId,
      targetUserId: userId,
    }));

    res.status(existingLike ? 200 : 201).json({
      liked: true,
      isMutual: reciprocalLikeExists,
      alreadyLiked: !!existingLike,
      targetUserId,
    });
  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({ error: 'Failed to like user' });
  }
};

export const unlikeUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { targetUserId } = req.params;
    const userId = req.user!.id;

    await Like.deleteOne({ userId, targetUserId });

    res.json({ liked: false, targetUserId });
  } catch (error) {
    console.error('Unlike user error:', error);
    res.status(500).json({ error: 'Failed to unlike user' });
  }
};

export const getLikeStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { targetUserId } = req.params;
    const userId = req.user!.id;

    const liked = !!(await Like.exists({ userId, targetUserId }));
    const isMutual =
      liked &&
      !!(await Like.exists({
        userId: targetUserId,
        targetUserId: userId,
      }));

    res.json({ liked, isMutual, targetUserId });
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({ error: 'Failed to get like status' });
  }
};

export const getReceivedLikes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = 100 } = req.query;
    const safeLimit = Math.max(1, Math.min(Number(limit), 200));

    const likes = await Like.find({ targetUserId: userId })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    if (!likes || likes.length === 0) {
      res.json({ likes: [] });
      return;
    }

    const likesWithUsers = await Promise.all(
      likes.map(async (like) => {
        const [likerUser, likerProfile, likerPhotos] = await Promise.all([
          User.findOne({ _id: like.userId, isActive: true }).select(
            'fullName dateOfBirth gender lastActive'
          ),
          Profile.findOne({ userId: like.userId }).select('bio segment'),
          Photo.find({ userId: like.userId }).sort({ order: 1 }),
        ]);

        return {
          like,
          user: likerUser,
          profile: likerProfile,
          photos: likerPhotos,
        };
      })
    );

    const validLikes = likesWithUsers.filter((item) => item.user !== null);

    res.json({ likes: validLikes });
  } catch (error) {
    console.error('Get received likes error:', error);
    res.status(500).json({ error: 'Failed to get received likes' });
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
    const safeLimit = Math.max(1, Math.min(Number(limit), 50));

    // Get current user's profile
    let currentProfile = await Profile.findOne({ userId });
    const currentSegment = currentProfile?.segment || 'relationship';

    // Auto-update user location if coordinates are provided (with throttling)
    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);

      // Check if we should update location (throttle to reduce DB writes)
      let shouldUpdateLocation = true;

      if (
        currentProfile?.latitude &&
        currentProfile?.longitude &&
        currentProfile?.locationUpdatedAt
      ) {
        const distanceMoved = calculateDistance(
          currentProfile.latitude,
          currentProfile.longitude,
          lat,
          lng
        );
        const timeSinceLastUpdate =
          Date.now() - new Date(currentProfile.locationUpdatedAt).getTime();

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

    // Add location-based filtering if available
    const hasLocation =
      currentProfile?.location?.coordinates ||
      (currentProfile?.latitude && currentProfile?.longitude);

    if (hasLocation && currentProfile) {
      let userLocation: { type: 'Point'; coordinates: [number, number] } | undefined;

      // Use GeoJSON location if available, otherwise convert lat/lng
      if (currentProfile.location?.coordinates) {
        userLocation = {
          type: 'Point',
          coordinates: [
            currentProfile.location.coordinates[0],
            currentProfile.location.coordinates[1],
          ],
        };
      } else if (currentProfile.latitude && currentProfile.longitude) {
        userLocation = {
          type: 'Point',
          coordinates: [currentProfile.longitude, currentProfile.latitude],
        };
      }

      if (!userLocation) {
        res.json({ users: [] });
        return;
      }

      // Default radius is 35km - show closest users first
      const maxDistance = 35000; // 35km in meters

      // Use aggregation to get profiles sorted by distance
      const nearbyProfiles = await Profile.aggregate([
        {
          $geoNear: {
            near: userLocation,
            distanceField: 'distance',
            maxDistance: maxDistance,
            spherical: true,
            query: {
              userId: { $ne: new Types.ObjectId(userId) },
              segment: currentSegment,
              isVisible: true,
            },
          },
        },
        {
          $sort: { distance: 1 }, // Sort by distance ascending (closest first)
        },
        {
          $limit: safeLimit,
        },
      ]);

      if (!nearbyProfiles || nearbyProfiles.length === 0) {
        res.json({ users: [] });
        return;
      }

      // Get user details and photos for each nearby profile
      const usersWithProfiles = await Promise.all(
        nearbyProfiles.map(async (profile) => {
          const user = await User.findById(profile.userId).select(
            'fullName dateOfBirth gender lastActive'
          );
          const photos = await Photo.find({ userId: profile.userId }).sort({ order: 1 });
          return {
            user,
            profile: {
              ...profile,
              distance: Math.round(profile.distance / 1000), // Convert to km
            },
            photos,
          };
        })
      );

      // Filter out any null users (in case user was deleted but profile remains)
      const validUsers = usersWithProfiles.filter((item) => item.user !== null);

      res.json({ users: validUsers });
      return;
    }

    // Fallback for users without location - return users in the same segment.
    const segmentProfiles = await Profile.find({
      userId: { $ne: new Types.ObjectId(userId) },
      segment: currentSegment,
      isVisible: true,
    })
      .limit(safeLimit)
      .lean();

    if (!segmentProfiles || segmentProfiles.length === 0) {
      res.json({ users: [] });
      return;
    }

    // Get user details and photos for each matched segment profile.
    const usersWithProfiles = await Promise.all(
      segmentProfiles.map(async (profile) => {
        const user = await User.findOne({ _id: profile.userId, isActive: true }).select(
          'fullName dateOfBirth gender lastActive'
        );
        const photos = await Photo.find({ userId: profile.userId }).sort({ order: 1 });

        return {
          user,
          profile,
          photos,
        };
      })
    );

    const validUsers = usersWithProfiles.filter((item) => item.user !== null);

    res.json({ users: validUsers });
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Failed to get nearby users' });
  }
};
