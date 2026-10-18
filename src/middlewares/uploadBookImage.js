import multer from "multer";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const storage = multer.memoryStorage();

const uploadBookImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, and WebP images are allowed.")
      );
    }

    callback(null, true);
  },
});

export default uploadBookImage;