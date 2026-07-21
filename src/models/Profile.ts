import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProfile extends Document {
  userId: Types.ObjectId;
  bio?: string;
  occupation?: string;
  education?: string;
  company?: string;
  school?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: Date;
  location?: {
    type: string;
    coordinates: number[];
  };
  height?: number;
  bodyType?: string;
  ethnicity?: string;
  drinking?: string;
  smoking?: string;
  religion?: string;
  politicalViews?: string;
  lookingFor?: string;
  interests: string[];
  segment: string;
  isVisible: boolean;
  showAge: boolean;
  showDistance: boolean;
  isComplete: boolean;
  completenessScore: number;
}

const geoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
      default: undefined,
      validate: {
        validator: (coords: number[] | undefined) => {
          if (!coords) return true;
          return (
            coords.length === 2 &&
            typeof coords[0] === 'number' &&
            !Number.isNaN(coords[0]) &&
            typeof coords[1] === 'number' &&
            !Number.isNaN(coords[1])
          );
        },
        message: 'location.coordinates must contain exactly [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: String,
    occupation: String,
    education: String,
    company: String,
    school: String,
    city: String,
    state: String,
    country: String,
    latitude: Number,
    longitude: Number,
    locationUpdatedAt: Date,
    location: {
      type: geoPointSchema,
      default: undefined,
    },
    height: Number,
    bodyType: String,
    ethnicity: String,
    drinking: String,
    smoking: String,
    religion: String,
    politicalViews: String,
    lookingFor: String,
    interests: { type: [String], default: [] },
    segment: { type: String, default: 'relationship' },
    isVisible: { type: Boolean, default: true },
    showAge: { type: Boolean, default: true },
    showDistance: { type: Boolean, default: true },
    isComplete: { type: Boolean, default: false },
    completenessScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Create 2dsphere index on location field for geospatial queries
profileSchema.index({ location: '2dsphere' });

export const Profile = mongoose.model<IProfile>('Profile', profileSchema);
