import mongoose from 'mongoose';
import dns from 'dns';

// Fix for systems where Node.js DNS resolver fails for SRV records (dev only)
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/relun_db';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB=====>>>');

    // Ensure indexes are created
    await mongoose.connection.syncIndexes();
    console.log('Database indexes synchronized=====>>>');
  } catch (error) {
    console.error('MongoDB connection error=====>>>', error);
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
