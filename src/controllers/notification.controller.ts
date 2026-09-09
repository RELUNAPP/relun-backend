import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PushToken, isExpoPushToken } from '../models/PushToken';

export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, platform } = req.body;
    const userId = req.user!.id;

    if (!isExpoPushToken(token)) {
      res.status(400).json({ error: 'Invalid push token' });
      return;
    }

    // Upsert on the token so re-registering the same device updates it, and a
    // device that switches accounts moves to the new user instead of keeping
    // both subscriptions alive.
    await PushToken.findOneAndUpdate(
      { token },
      { token, userId, platform: platform === 'ios' || platform === 'android' ? platform : undefined },
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

    if (!isExpoPushToken(token)) {
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
