import mongoose from "mongoose";
import User from "../models/User.js";

export async function applyToBecomeSeller(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable",
      });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Only regular users can apply to become sellers",
      });
    }

    if (user.sellerApplicationStatus === "pending") {
      return res.status(409).json({
        success: false,
        message: "Your application is already pending",
      });
    }

    user.sellerApplicationStatus = "pending";
    user.sellerApplicationReason = req.body.reason?.trim() || "";
    user.sellerAppliedAt = new Date();
    user.sellerReviewedAt = null;
    user.sellerReviewedBy = null;

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Seller application submitted successfully",
      data: {
        status: user.sellerApplicationStatus,
        appliedAt: user.sellerAppliedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMySellerApplication(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select(
      "role sellerApplicationStatus sellerApplicationReason sellerAppliedAt sellerReviewedAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        role: user.role,
        status: user.sellerApplicationStatus,
        reason: user.sellerApplicationReason,
        appliedAt: user.sellerAppliedAt,
        reviewedAt: user.sellerReviewedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSellerApplications(req, res, next) {
  try {
    const applications = await User.find({
      sellerApplicationStatus: "pending",
    })
      .select("name email sellerApplicationReason sellerAppliedAt")
      .sort({ sellerAppliedAt: 1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewSellerApplication(req, res, next) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    if (userId === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot review your own application",
      });
    }

    const applicant = await User.findById(userId);

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found",
      });
    }

    if (!applicant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Inactive accounts cannot be approved as sellers",
      });
    }

    if (
      applicant.role !== "user" ||
      applicant.sellerApplicationStatus !== "pending"
    ) {
      return res.status(409).json({
        success: false,
        message: "This user has no pending seller application",
      });
    }

    applicant.sellerApplicationStatus = status;
    applicant.sellerReviewedAt = new Date();
    applicant.sellerReviewedBy = req.user._id;

    if (status === "approved") {
      applicant.role = "seller";
    }

    await applicant.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Seller application approved"
          : "Seller application rejected",
      data: {
        userId: applicant._id,
        role: applicant.role,
        status: applicant.sellerApplicationStatus,
        reviewedAt: applicant.sellerReviewedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}