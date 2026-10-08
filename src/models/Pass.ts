import mongoose, { Schema, Document, Types } from 'mongoose';

// A "not interested" from Discover. Kept so passed people stop reappearing.
export interface IPass extends Document {
  userId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  createdAt: Date;
}

const passSchema = new Schema<IPass>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

passSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export const Pass = mongoose.model<IPass>('Pass', passSchema);
