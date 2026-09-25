function errorHandler(error, req, res, next) {
  const proposedStatus = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const statusCode = proposedStatus >= 400 && proposedStatus <= 599
    ? proposedStatus
    : 500;
  const safeConfigurationMessage = statusCode === 503
    && typeof error?.safeMessage === 'string'
    && error.safeMessage.trim()
    ? error.safeMessage
    : null;

  if (safeConfigurationMessage) {
    // Only explicitly marked configuration diagnostics are safe to log/return.
    console.error(`[auth] ${error.code || 'CONFIGURATION_ERROR'}: ${safeConfigurationMessage}`);
  }

  let message;

  if (error?.type === 'entity.parse.failed' || (error instanceof SyntaxError && statusCode === 400)) {
    message = 'Malformed JSON request';
  } else if (error?.type === 'entity.too.large') {
    message = 'Request body is too large';
  } else if (safeConfigurationMessage) {
    message = safeConfigurationMessage;
  } else if (statusCode >= 500) {
    message = 'Internal server error';
  } else if (error?.expose === true) {
    message = error.message || 'Request failed';
  } else {
    message = 'Invalid request data';
  }

  return res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
