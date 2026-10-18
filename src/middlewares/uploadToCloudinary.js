
import cloudinary from "../config/cloudinary.js";

export default async function uploadToCloudinary(req, res, next) {
  // Image is optional. Books can be created without a cover.
  if (!req.file) {
    return next();
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "chapter/books",
          resource_type: "image",
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);
          } else {
            resolve(uploadResult);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    // The existing validator and controller can now use this URL.
    req.body.coverImage = result.secure_url;

    // Keep the public ID for possible cleanup later.
    req.cloudinaryImage = {
      publicId: result.public_id,
    };

    next();
  } catch (error) {
    console.error("Cloudinary book image upload failed:", error);

    return res.status(502).json({
      success: false,
      message: "Failed to upload book cover. Please try again.",
    });
  }
}
