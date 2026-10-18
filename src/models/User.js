
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
      
     bio: {
  type: String,
  trim: true,
  maxlength: [300, "Bio cannot exceed 300 characters"],
  default: "",
},

 profileImage: {
  type: String,
  default: "",
},
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

      resetPasswordToken: {
  type: String,
  default: undefined,
   select: false,
    },

resetPasswordExpires: {
  type: Date,
  default: undefined,
  select: false,
},

    role: {
      type: String,
      enum: ["user", "seller", "admin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sellerApplicationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },

    sellerApplicationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Application reason cannot exceed 500 characters"],
      default: "",
    },

    sellerAppliedAt: {
      type: Date,
      default: null,
    },

    sellerReviewedAt: {
      type: Date,
      default: null,
    },

    sellerReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
