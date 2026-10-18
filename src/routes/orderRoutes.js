
import { Router } from "express";

import {
  checkout,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getSellerOrders,
  updateSellerItemStatus,
  getSellerInventory,
} from "../controllers/orderController.js";

import {
  authenticate,
  authorize,
  requireApprovedSeller,
} from "../middlewares/authMiddleware.js";

const router = Router();

// All order routes require authentication.
router.use(authenticate);

// Buyer routes
router.post("/checkout", checkout);
router.get("/", getMyOrders);

// Seller dashboard routes
// Keep these before the generic /:orderId routes.
router.get(
  "/seller/orders",
  authorize("seller"),
  requireApprovedSeller,
  getSellerOrders
);

router.get(
  "/seller/inventory",
  authorize("seller"),
  requireApprovedSeller,
  getSellerInventory
);

router.patch(
  "/seller/:orderId/items/:bookId/status",
  authorize("seller"),
  requireApprovedSeller,
  updateSellerItemStatus
);

// Admin routes
// Keep these above /:orderId routes.
router.get(
  "/admin/all",
  authorize("admin"),
  getAllOrders
);

router.patch(
  "/admin/:orderId/status",
  authorize("admin"),
  updateOrderStatus
);

// Buyer order details and cancellation
router.get("/:orderId", getOrderById);
router.patch("/:orderId/cancel", cancelOrder);

export default router;
