const mongoose = require('mongoose');
const dns = require('dns');

let connectionPromise = null;

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

const openConnection = () =>
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  // Reuse the same in-flight connection in warm serverless functions.
  if (mongoose.connection.readyState === 2 && connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = openConnection()
    .catch(async (err) => {
      if (err?.code === 'ECONNREFUSED' && err?.syscall === 'querySrv') {
        applyDnsFallback();
        return openConnection();
      }
      throw err;
    })
    .then(() => {
      console.log('MongoDB connected');
      return mongoose.connection;
    })
    .catch((err) => {
      // Allow a later request to retry after Atlas resumes or a transient failure clears.
      connectionPromise = null;
      console.error('MongoDB connection error:', err.message);
      throw err;
    });

  return connectionPromise;
};

module.exports = connectDB;
