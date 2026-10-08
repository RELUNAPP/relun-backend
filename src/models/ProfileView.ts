import mongoose, { Schema, Document, Types } from 'mongoose';

// One row per (viewer, viewed) pair, bumped on each visit.
export interface IProfileView extends Document {
  viewerId: Types.ObjectId;
  viewedId: Types.ObjectId;
  lastViewedAt: Date;
}

const profileViewSchema = new Schema<IProfileView>({
  viewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  viewedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastViewedAt: { type: Date, default: Date.now },
});

profileViewSchema.index({ viewerId: 1, viewedId: 1 }, { unique: true });
profileViewSchema.index({ viewedId: 1, lastViewedAt: -1 });

export const ProfileView = mongoose.model<IProfileView>('ProfileView', profileViewSchema);
