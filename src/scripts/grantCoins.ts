/**
 * Gives every active user the same number of coins, once per tag.
 *
 *   npx tsx src/scripts/grantCoins.ts --amount 500 --tag grant-2026-10-07 [--announce] [--dry-run]
 *
 * Each grant is a 'bonus' CoinTransaction with refId = tag, so the coin history
 * shows it and running the script again skips users who already have it.
 * --announce makes the apps show the "you got coins" sheet for it.
 */
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, closeDB } from '../config/database';
import { User } from '../models/User';
import { CoinTransaction } from '../models/CoinTransaction';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const main = async () => {
  const amount = Number(arg('amount'));
  const tag = arg('tag');
  const announce = process.argv.includes('--announce');
  const dryRun = process.argv.includes('--dry-run');

  if (!Number.isInteger(amount) || amount <= 0 || !tag) {
    console.error('Usage: grantCoins.ts --amount <coins> --tag <unique-tag> [--announce] [--dry-run]');
    process.exit(1);
  }

  await connectDB();

  const users = await User.find({ isActive: { $ne: false } }).select('_id').lean();
  const already = new Set(
    (await CoinTransaction.find({ refId: tag, reason: 'bonus' }).select('userId').lean()).map((t) =>
      t.userId.toString()
    )
  );
  const todo = users.filter((u) => !already.has(u._id.toString()));

  console.log(
    `${users.length} active users, ${already.size} already have "${tag}", ${todo.length} to credit ${amount} coins` +
      (dryRun ? ' (dry run, nothing written)' : '')
  );

  if (!dryRun) {
    for (const u of todo) {
      const tx = await CoinTransaction.create({
        userId: u._id,
        amount,
        balanceAfter: 0,
        reason: 'bonus',
        refId: tag,
        announced: !announce,
      });
      const updated = await User.findByIdAndUpdate(u._id, { $inc: { coins: amount } }, { new: true })
        .select('coins')
        .lean();
      await CoinTransaction.updateOne({ _id: tx._id }, { balanceAfter: updated?.coins ?? amount });
    }
    console.log(`Credited ${todo.length} users.`);
  }

  await closeDB();
};

main().catch(async (error) => {
  console.error(error);
  await closeDB().catch(() => {});
  process.exit(1);
});
