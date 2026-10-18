
import cloudinary from "../config/cloudinary.js";

export default async function uploadProfileImageToCloudinary(
  req,
  res,
  next
) {
  if (!req.file) {
    return next();
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "chapter/profiles",
          resource_type: "image",
          transformation: [
            {
              width: 500,
              height: 500,
              crop: "limit",
            },
          ],
        },
        (error, uploadResult) => {
          if (error) {
            return reject(error);
          }

          resolve(uploadResult);
        }
      );

      stream.end(req.file.buffer);
    });

    // Make the uploaded URL available to the controller.
    req.uploadedProfileImageUrl = result.secure_url;

    req.cloudinaryProfileImage = {
      publicId: result.public_id,
    };

    return next();
  } catch (error) {
    console.error("Cloudinary profile image upload failed:", error);

    return res.status(502).json({
      success: false,
      message: "Failed to upload profile photo. Please try again.",
    });
  }
}
