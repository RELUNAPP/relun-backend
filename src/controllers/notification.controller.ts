import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PushToken, PushProvider, isExpoPushToken, isFcmToken } from '../models/PushToken';

// Expo tokens are recognisable by shape; anything else must say it is FCM.
const resolveProvider = (token: unknown, provider: unknown): PushProvider | null => {
  if (isExpoPushToken(token)) return 'expo';
  if (provider === 'fcm' && isFcmToken(token)) return 'fcm';
  return null;
};

export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, platform, provider } = req.body;
    const userId = req.user!.id;
    const resolvedProvider = resolveProvider(token, provider);

    if (!resolvedProvider) {
      res.status(400).json({ error: 'Invalid push token' });
      return;
    }

    // Upsert on the token so re-registering the same device updates it, and a
    // device that switches accounts moves to the new user instead of keeping
    // both subscriptions alive.
    await PushToken.findOneAndUpdate(
      { token },
      {
        token,
        userId,
        provider: resolvedProvider,
        platform: platform === 'ios' || platform === 'android' ? platform : undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ registered: true });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
};

export const deletePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const userId = req.user!.id;

    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'Invalid push token' });
      return;
    }

    // Scoped to the caller so one user cannot unregister another's device.
    await PushToken.deleteOne({ token, userId });

    res.json({ removed: true });
  } catch (error) {
    console.error('Delete push token error:', error);
    res.status(500).json({ error: 'Failed to remove push token' });
  }
};
