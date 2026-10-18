
import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:bookId", updateCartItem);
router.delete("/items/:bookId", removeCartItem);
router.delete("/", clearCart);

export default router;
