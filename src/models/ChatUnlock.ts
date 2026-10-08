import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A conversation that has been opened, either by one side paying coins or by
 * an accepted date request. One row opens the chat for both users, for good.
 */
export interface IChatUnlock extends Document {
  conversationId: string;
  unlockedBy: Types.ObjectId;
  source: 'coins' | 'date';
  createdAt: Date;
}

const chatUnlockSchema = new Schema<IChatUnlock>(
  {
    conversationId: { type: String, required: true, unique: true },
    unlockedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['coins', 'date'], default: 'coins' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ChatUnlock = mongoose.model<IChatUnlock>('ChatUnlock', chatUnlockSchema);
