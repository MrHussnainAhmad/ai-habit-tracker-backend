const mongoose = require('mongoose');
const dns = require('dns');

const applyDnsFallback = () => {
  // Use public resolvers for SRV lookups when local resolver blocks/refuses them.
  const fallback = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (fallback.length > 0) {
    dns.setServers(fallback);
  }
};

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' && err?.syscall === 'querySrv') {
      try {
        applyDnsFallback();
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
        return;
      } catch (retryErr) {
        console.error('MongoDB connection error:', retryErr.message);
        throw retryErr;
      }
    }
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

module.exports = connectDB;
