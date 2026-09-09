import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform?: 'ios' | 'android';
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Unique on the token, not on (user, token): a device handed to another
    // account must move rather than end up delivering to both.
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android'] },
  },
  { timestamps: true }
);

// Expo tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
export const isExpoPushToken = (value: unknown): value is string =>
  typeof value === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(value);

export const PushToken = mongoose.model<IPushToken>('PushToken', pushTokenSchema);
