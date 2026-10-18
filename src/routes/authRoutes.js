
import { Router } from "express";

import {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

import { authenticate } from "../middlewares/authMiddleware.js";
import uploadProfileImage from "../middlewares/uploadProfileImage.js";
import uploadProfileImageToCloudinary from "../middlewares/uploadProfileImageToCloudinary.js";

import { validateRegister } from "../validators/authValidator.js";
import { validateLogin } from "../validators/loginValidator.js";

const router = Router();

// Public routes
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);

// Password recovery routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected routes
router.get("/me", authenticate, getMe);

router.patch(
  "/profile",
  authenticate,
  uploadProfileImage.single("profileImage"),
  uploadProfileImageToCloudinary,
  updateProfile
);

export default router;
