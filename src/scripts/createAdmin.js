import "dotenv/config";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { connectDB } from "../config/db.js";

async function createAdmin() {
  try {
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured."
      );
    }

    if (password.length < 12) {
      throw new Error("Admin password must contain at least 12 characters.");
    }

    await connectDB();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log("An admin account with this email already exists.");
        return;
      }

      throw new Error(
        "This email already belongs to a non-admin account. " +
          "Choose a new email for the initial admin account."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
      sellerApplicationStatus: "none",
    });

    console.log("Admin account created successfully.");
    console.log(`Admin email: ${admin.email}`);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    const mongoose = await import("mongoose");

    if (mongoose.default.connection.readyState !== 0) {
      await mongoose.default.connection.close();
    }
  }
}

createAdmin();