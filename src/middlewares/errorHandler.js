
import multer from "multer";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Handle Multer upload errors.
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Book cover image must be 5 MB or smaller.",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected image field. Use coverImage.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Invalid image upload.",
    });
  }

  // Handle rejected file types from uploadBookImage.js.
  if (
    err.message ===
    "Only JPG, PNG, and WebP images are allowed."
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Preserve your existing error-handling behavior.
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Internal server error"
        : err.message || "Request failed",
  });
}
