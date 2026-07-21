import jwt, { SignOptions, Secret } from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || 'your-secret-key';
};

export interface TokenPayload {
  userId: string;
  email?: string;
  phone?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, getJwtSecret() as Secret, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRY as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, getJwtSecret() as Secret, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
};

export const generateTokenPair = (payload: TokenPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};
