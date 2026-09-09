import { PushToken } from '../models/PushToken';
import { User } from '../models/User';
import { Message } from '../models/Message';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts at most 100 messages per request.
const EXPO_BATCH_SIZE = 100;
const PREVIEW_LENGTH = 120;

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
};

type ExpoTicket = {
  status?: 'ok' | 'error';
  details?: { error?: string };
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
};

const deliver = async (tokens: string[], payload: PushPayload): Promise<void> => {
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Only needed if the Expo project has push security enabled.
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.error('Expo push rejected the request:', response.status);
    return;
  }

  const result = (await response.json()) as { data?: ExpoTicket[] };
  const tickets = result.data || [];

  // Tickets come back aligned with the messages we sent. Uninstalled apps
  // report DeviceNotRegistered; drop those or they accumulate forever.
  const deadTokens = tickets
    .map((ticket, index) =>
      ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? tokens[index]
        : null
    )
    .filter((token): token is string => !!token);

  if (deadTokens.length > 0) {
    await PushToken.deleteMany({ token: { $in: deadTokens } });
  }
};

/**
 * Fire-and-forget. A push that fails is not worth retrying: the message is
 * already in MongoDB and the user sees it on next open, and a stale
 * notification has close to zero value. This never throws, so callers can
 * `void` it without risking the request they are serving.
 */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<void> => {
  try {
    const tokens = await PushToken.find({ userId }).select('token').lean();

    if (tokens.length === 0) {
      return;
    }

    for (const batch of chunk(
      tokens.map((entry) => entry.token),
      EXPO_BATCH_SIZE
    )) {
      await deliver(batch, payload);
    }
  } catch (error) {
    console.error('Send push error:', error);
  }
};

const preview = (content: string): string =>
  content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH - 1)}…` : content;

export const notifyNewMessage = async (params: {
  recipientId: string;
  senderId: string;
  content: string;
}): Promise<void> => {
  try {
    const [sender, unreadCount] = await Promise.all([
      User.findById(params.senderId).select('fullName').lean(),
      Message.countDocuments({ receiverId: params.recipientId, isRead: false }),
    ]);

    await sendPushToUser(params.recipientId, {
      title: sender?.fullName || 'New message',
      body: preview(params.content),
      badge: unreadCount,
      // The app reads this to open the right conversation on tap.
      data: { type: 'message', userId: params.senderId },
    });
  } catch (error) {
    console.error('Notify new message error:', error);
  }
};

export const notifyNewMatch = async (params: {
  recipientId: string;
  matchedUserId: string;
}): Promise<void> => {
  try {
    const matchedUser = await User.findById(params.matchedUserId).select('fullName').lean();

    await sendPushToUser(params.recipientId, {
      title: "It's a match!",
      body: `You and ${matchedUser?.fullName || 'someone'} liked each other.`,
      data: { type: 'match', userId: params.matchedUserId },
    });
  } catch (error) {
    console.error('Notify new match error:', error);
  }
};
