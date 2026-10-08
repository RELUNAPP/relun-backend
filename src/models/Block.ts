import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBlock extends Document {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
}

const blockSchema = new Schema<IBlock>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export const Block = mongoose.model<IBlock>('Block', blockSchema);

// Blocking works both ways: neither side can see or reach the other.
export const isBlockedEitherWay = async (a: string, b: string): Promise<boolean> =>
  !!(await Block.exists({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  }));

export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  const blocks = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] })
    .select('blockerId blockedId')
    .lean();

  return blocks.map((block) =>
    block.blockerId.toString() === userId ? block.blockedId.toString() : block.blockerId.toString()
  );
};
