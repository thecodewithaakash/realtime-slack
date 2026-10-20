export function notFound(req, res) {
  return res.status(404).json({ message: "That route could not be found." });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "A record with that name or address already exists." });
  }
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({
      message: error.status === 413 ? "Request body is too large." : "The request body is invalid.",
    });
  }
  console.error(error);
  return res.status(error.statusCode ?? 500).json({
    message: error.statusCode ? error.message : "An unexpected server error occurred.",
  });
}
