
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";

import { sendWelcomeEmail } from "../config/mail/nodemailer.js";
import emailTemplates from "../config/mail/emailTemplate.js";

function createAccessToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing from environment variables");
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    secret,
    { expiresIn: "1d" }
  );
}

// Return consistent user data to the frontend.
function formatUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    profileImage: user.profileImage || "",
  };
}

// Register a new reader and attempt to send a welcome email.
export async function register(req, res, next) {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
    });

    try {
      await sendWelcomeEmail(
        user.email,
        "Welcome to Readify!",
        emailTemplates.welcome_mail,
        { name: user.name }
      );
    } catch (emailError) {
      console.error(
        "Registration succeeded, but the welcome email failed:",
        emailError.message
      );
    }

    const accessToken = createAccessToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: formatUser(user),
        accessToken,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return next(error);
  }
}

// Log in an existing account.
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = createAccessToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: formatUser(user),
        accessToken,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// Request a password-reset email.
export async function forgotPassword(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (typeof email !== "string" || !email) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const responseMessage =
      "If an account exists with this email, a password reset link will be sent.";

    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store only the hash of the reset token.
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    // CLIENT_URL is the existing frontend URL environment variable.
    const frontendUrl = process.env.CLIENT_URL;

    if (!frontendUrl) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      throw new Error("CLIENT_URL is missing from environment variables");
    }

    const resetLink =
      `${frontendUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    try {
      await sendWelcomeEmail(
        user.email,
        "Reset Your Readify Password",
        emailTemplates.reset_password,
        {
          name: user.name,
          resetLink,
          expiryMinutes: 15,
        }
      );
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      console.error("Password reset email failed:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send the reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });
  } catch (error) {
    return next(error);
  }
}

// Reset a password using a valid, unexpired, single-use token.
export async function resetPassword(req, res, next) {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (
      !token ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Token, password, and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const hashedResetToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedResetToken,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true,
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
}

// Get the latest data for the authenticated account.
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}

// Update the logged-in user's name, bio, and profile photo.
export async function updateProfile(req, res, next) {
  try {
    const { name, bio } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }

      if (name.trim().length > 80) {
        return res.status(400).json({
          success: false,
          message: "Name cannot exceed 80 characters",
        });
      }

      updates.name = name.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({
          success: false,
          message: "Bio must be a string",
        });
      }

      if (bio.trim().length > 300) {
        return res.status(400).json({
          success: false,
          message: "Bio cannot exceed 300 characters",
        });
      }

      updates.bio = bio.trim();
    }

    if (req.uploadedProfileImageUrl) {
      updates.profileImage = req.uploadedProfileImageUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No profile changes were provided",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}
