function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({ error: error.message || 'Internal server error' });
}

module.exports = errorHandler;
