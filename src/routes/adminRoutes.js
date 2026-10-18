
import { Router } from "express";

import {
  getDashboardStats,
  getAdminUsers,
  updateUserStatus,
} from "../controllers/adminController.js";

import {
  authenticate,
  authorize,
} from "../middlewares/authMiddleware.js";

const router = Router();

// All routes in this router require an authenticated admin.
router.use(authenticate, authorize("admin"));

router.get("/dashboard", getDashboardStats);

router.get("/users", getAdminUsers);

router.patch("/users/:userId/status", updateUserStatus);

export default router;
