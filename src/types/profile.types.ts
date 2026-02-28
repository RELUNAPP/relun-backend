// Profile types
export interface Profile {
  id: string;
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileWithUser extends Profile {
  user: {
    id: string;
    fullName?: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female';
    lastActive?: Date;
  };
  photos: {
    id: string;
    url: string;
    order: number;
  }[];
  distance?: number;
}

export interface CreateProfileDto {
  userId: string;
  bio?: string;
  occupation?: string;
  interests?: string[];
}

export interface UpdateProfileDto {
  bio?: string;
  occupation?: string;
  education?: string;
  company?: string;
  school?: string;
  city?: string;
  state?: string;
  country?: string;
  height?: number;
  bodyType?: string;
  ethnicity?: string;
  drinking?: string;
  smoking?: string;
  religion?: string;
  politicalViews?: string;
  lookingFor?: string;
  interests?: string[];
  segment?: string;
  isVisible?: boolean;
  showAge?: boolean;
  showDistance?: boolean;
}

export interface UserDto {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
}

export interface CompleteProfileResponseDto {
  user: UserDto;
  profile: Record<string, unknown>;
  isComplete: boolean;
}
