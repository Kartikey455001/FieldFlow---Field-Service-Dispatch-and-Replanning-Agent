/**
 * Centralized Express Error Handling Middleware
 */
export default function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR');

  console.error(`[API Error] [${req.method}] ${req.originalUrl} - ${statusCode} ${errorCode}: ${err.message}`);

  // Sanitize message to strip any potential leaked credentials or keys
  let sanitizedMessage = err.message || 'An unexpected server error occurred.';
  sanitizedMessage = sanitizedMessage
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://[credentials_hidden]@')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[api_key_hidden]')
    .replace(/AQ\.[0-9A-Za-z-_]{35,}/g, '[api_key_hidden]');

  const response = {
    success: false,
    message: sanitizedMessage,
    code: errorCode,
  };

  if (err.details) {
    response.details = err.details;
  }

  // Only include stack in local development debugging if explicitly requested
  if (process.env.NODE_ENV === 'development' && process.env.SHOW_STACK === 'true') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
