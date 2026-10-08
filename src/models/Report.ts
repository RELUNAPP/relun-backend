import mongoose, { Schema, Document, Types } from 'mongoose';

export const REPORT_REASONS = [
  'fake_profile',
  'inappropriate_content',
  'harassment',
  'scam',
  'underage',
  'other',
] as const;

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  reportedId: Types.ObjectId;
  reason: (typeof REPORT_REASONS)[number];
  details?: string;
  status: 'open' | 'reviewed' | 'actioned';
  createdAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, enum: REPORT_REASONS, default: 'other' },
    details: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open' },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>('Report', reportSchema);
