import { isMatched } from '../models/Like';
import { isBlockedEitherWay } from '../models/Block';
import { ChatUnlock } from '../models/ChatUnlock';
import { Message, getConversationId } from '../models/Message';
import { isChatUnlockEnforced } from '../config/coins';

export type ChatAccess = 'ok' | 'not_matched' | 'blocked' | 'locked';

/** Can these two users see each other's conversation at all? */
export const canViewConversation = async (userId: string, otherId: string): Promise<boolean> =>
  (await isMatched(userId, otherId)) && !(await isBlockedEitherWay(userId, otherId));

export const isChatUnlocked = async (userId: string, otherId: string): Promise<boolean> => {
  if (!isChatUnlockEnforced()) {
    return true;
  }

  const conversationId = getConversationId(userId, otherId);

  if (await ChatUnlock.exists({ conversationId })) {
    return true;
  }

  // Conversations that already had messages before unlocks existed stay open.
  return !!(await Message.exists({ conversationId }));
};

/** Sending needs a match, no block, and an unlocked conversation. */
export const getChatAccess = async (userId: string, otherId: string): Promise<ChatAccess> => {
  if (!(await isMatched(userId, otherId))) return 'not_matched';
  if (await isBlockedEitherWay(userId, otherId)) return 'blocked';
  if (!(await isChatUnlocked(userId, otherId))) return 'locked';
  return 'ok';
};

export const CHAT_ACCESS_ERRORS: Record<Exclude<ChatAccess, 'ok'>, string> = {
  not_matched: 'You can only chat with your matches',
  blocked: 'This conversation is no longer available',
  locked: 'Unlock this chat to start messaging',
};

export const unlockedConversationIds = async (conversationIds: string[]): Promise<Set<string>> => {
  if (!isChatUnlockEnforced()) {
    return new Set(conversationIds);
  }

  const [unlocks, withMessages] = await Promise.all([
    ChatUnlock.find({ conversationId: { $in: conversationIds } })
      .select('conversationId')
      .lean(),
    Message.distinct('conversationId', { conversationId: { $in: conversationIds } }),
  ]);

  return new Set([...unlocks.map((unlock) => unlock.conversationId), ...withMessages]);
};
