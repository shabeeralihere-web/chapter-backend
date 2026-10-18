
import { Router } from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getWishlist);
router.post("/:bookId", addToWishlist);
router.delete("/:bookId", removeFromWishlist);
router.delete("/", clearWishlist);

export default router;
