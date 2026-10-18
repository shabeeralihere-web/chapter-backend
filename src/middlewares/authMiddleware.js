
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is missing from environment variables");
    }

    const decoded = jwt.verify(token, secret);

    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }

    // Always use the current database role, not the role in the JWT.
    const user = await User.findById(decoded.sub).select(
      "_id name email role isActive sellerApplicationStatus"
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    return next(error);
  }
}

// Allows public endpoints to work without a token.
// If a token is provided, it must be valid.
export async function optionalAuthenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return next();
  }

  return authenticate(req, res, next);
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    return next();
  };
}

// Admins can manage all books.
// Sellers must have an approved application.
export function requireApprovedSeller(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role === "admin") {
    return next();
  }

  if (
    req.user.role !== "seller" ||
    req.user.sellerApplicationStatus !== "approved"
  ) {
    return res.status(403).json({
      success: false,
      message: "An approved seller account is required to manage books",
    });
  }

  return next();
}
