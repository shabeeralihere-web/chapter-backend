
import { Router } from "express";

import {
  createAddress,
  getMyAddresses,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../controllers/addressController.js";

import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

// All address endpoints require login.
router.use(authenticate);

router.route("/")
  .post(createAddress)
  .get(getMyAddresses);

router.patch("/:addressId/default", setDefaultAddress);
router.patch("/:addressId", updateAddress);
router.delete("/:addressId", deleteAddress);

export default router;
