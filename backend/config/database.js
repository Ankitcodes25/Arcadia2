const mongoose = require('mongoose');
const { mongoUri, validateMongoUri } = require('./env');

let connectionPromise = null;

async function connectDatabase(uri = mongoUri) {
  validateMongoUri(uri);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  mongoose.set('strictQuery', true);

  connectionPromise = mongoose
    .connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => mongoose.connection)
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

function assertDatabaseConnection() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection is not ready');
  }
}

function getDatabaseState() {
  return mongoose.connection.readyState;
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  assertDatabaseConnection,
  getDatabaseState,
};
