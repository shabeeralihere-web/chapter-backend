
import { Router } from "express";

import {
  applyToBecomeSeller,
  getMySellerApplication,
  getSellerApplications,
  reviewSellerApplication,
} from "../controllers/sellerController.js";

import {
  authenticate,
  authorize,
} from "../middlewares/authMiddleware.js";

const router = Router();

// Logged-in users can submit and check their own application.
router.post(
  "/applications",
  authenticate,
  applyToBecomeSeller
);

router.get(
  "/applications/me",
  authenticate,
  getMySellerApplication
);

// Only admins can review applications.
router.get(
  "/applications",
  authenticate,
  authorize("admin"),
  getSellerApplications
);

router.patch(
  "/applications/:userId",
  authenticate,
  authorize("admin"),
  reviewSellerApplication
);

export default router;
