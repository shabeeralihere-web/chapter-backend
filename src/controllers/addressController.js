
import mongoose from "mongoose";
import Address from "../models/Address.js";

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

const allowedFields = [
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "country",
];

function validateAddress(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Address details are required";
  }

  const requiredFields = [
    "fullName",
    "phone",
    "addressLine1",
    "city",
    "state",
    "postalCode",
    "country",
  ];

  for (const field of requiredFields) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim()
    ) {
      return `${field} is required`;
    }
  }

  const limits = {
    fullName: 100,
    phone: 25,
    addressLine1: 200,
    addressLine2: 200,
    city: 100,
    state: 100,
    postalCode: 20,
    country: 100,
  };

  for (const [field, maxLength] of Object.entries(limits)) {
    if (data[field] !== undefined) {
      if (
        typeof data[field] !== "string" ||
        data[field].trim().length > maxLength
      ) {
        return `${field} must be a string of at most ${maxLength} characters`;
      }
    }
  }

  return null;
}

function getAddressFields(data) {
  const fields = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields[field] =
        typeof data[field] === "string"
          ? data[field].trim()
          : data[field];
    }
  }

  return fields;
}

// POST /api/addresses
export async function createAddress(req, res, next) {
  try {
    const validationError = validateAddress(req.body);

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const addressData = getAddressFields(req.body);

    const existingDefault = await Address.exists({
      user: req.user._id,
      isDefault: true,
    });

    // The first saved address becomes the default automatically.
    addressData.isDefault =
      req.body.isDefault === true || !existingDefault;

    // If making this address the default, unset the previous default.
    if (addressData.isDefault) {
      await Address.updateMany(
        { user: req.user._id, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const address = await Address.create({
      ...addressData,
      user: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/addresses
export async function getMyAddresses(req, res, next) {
  try {
    const addresses = await Address.find({
      user: req.user._id,
    }).sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/addresses/:addressId
export async function updateAddress(req, res, next) {
  try {
    const { addressId } = req.params;

    if (!mongoose.isValidObjectId(addressId)) {
      return sendError(res, 400, "Invalid address ID");
    }

    const address = await Address.findOne({
      _id: addressId,
      user: req.user._id,
    });

    if (!address) {
      return sendError(res, 404, "Address not found");
    }

    const validationError = validateAddress({
      ...Object.fromEntries(
        allowedFields.map((field) => [field, address[field] ?? ""])
      ),
      ...req.body,
    });

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const updates = getAddressFields(req.body);

    if (req.body.isDefault === true) {
      await Address.updateMany(
        { user: req.user._id, isDefault: true },
        { $set: { isDefault: false } }
      );

      address.isDefault = true;
    }

    for (const [field, value] of Object.entries(updates)) {
      address[field] = value;
    }

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/addresses/:addressId/default
export async function setDefaultAddress(req, res, next) {
  try {
    const { addressId } = req.params;

    if (!mongoose.isValidObjectId(addressId)) {
      return sendError(res, 400, "Invalid address ID");
    }

    const address = await Address.findOne({
      _id: addressId,
      user: req.user._id,
    });

    if (!address) {
      return sendError(res, 404, "Address not found");
    }

    await Address.updateMany(
      { user: req.user._id, isDefault: true },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated",
      data: address,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/addresses/:addressId
export async function deleteAddress(req, res, next) {
  try {
    const { addressId } = req.params;

    if (!mongoose.isValidObjectId(addressId)) {
      return sendError(res, 400, "Invalid address ID");
    }

    const address = await Address.findOneAndDelete({
      _id: addressId,
      user: req.user._id,
    });

    if (!address) {
      return sendError(res, 404, "Address not found");
    }

    // If the default address was deleted, promote the newest remaining one.
    if (address.isDefault) {
      const nextDefault = await Address.findOne({
        user: req.user._id,
      }).sort({ createdAt: -1 });

      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
