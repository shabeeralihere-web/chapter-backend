
import { Router } from "express";

import {
  getBooks,
  getMyBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} from "../controllers/bookController.js";

import {
  validateCreateBook,
  validateUpdateBook,
} from "../validators/bookValidator.js";

import {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireApprovedSeller,
} from "../middlewares/authMiddleware.js";

import uploadBookImage from "../middlewares/uploadBookImage.js";
import uploadToCloudinary from "../middlewares/uploadToCloudinary.js";

const router = Router();

// Public catalogue.
// Visitors can browse without signing in.
// Logged-in sellers are identified so their own books can be excluded.
router.get("/", optionalAuthenticate, getBooks);

// Authenticated, approved sellers can see their own books.
// Keep this route before "/:id".
router.get(
  "/my-books",
  authenticate,
  authorize("seller"),
  requireApprovedSeller,
  getMyBooks
);

// Public single-book details.
router.get("/:id", getBookById);

// Admins and approved sellers can add books.
router.post(
  "/",
  authenticate,
  authorize("seller", "admin"),
  requireApprovedSeller,
  uploadBookImage.single("coverImage"),
  uploadToCloudinary,
  validateCreateBook,
  createBook
);

// Admins can update any book.
// Sellers can update only their own books.
router.patch(
  "/:id",
  authenticate,
  authorize("seller", "admin"),
  requireApprovedSeller,
  uploadBookImage.single("coverImage"),
  uploadToCloudinary,
  validateUpdateBook,
  updateBook
);

// Admins can delete any book.
// Sellers can delete only their own books.
router.delete(
  "/:id",
  authenticate,
  authorize("seller", "admin"),
  requireApprovedSeller,
  deleteBook
);

export default router;
