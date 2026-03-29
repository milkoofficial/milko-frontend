const { NotFoundError } = require('../utils/errors');

/**
 * 404 Not Found Middleware
 * Handles routes that don't exist
 */
const notFound = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

module.exports = notFound;

