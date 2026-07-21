import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILike extends Document {
  userId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

likeSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export const Like = mongoose.model<ILike>('Like', likeSchema);
