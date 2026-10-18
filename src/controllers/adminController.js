
import mongoose from "mongoose";
import Book from "../models/Book.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import {
  sendBlockUnblockEmail,
} from "../config/mail/nodemailer.js";
import emailTemplates from "../config/mail/emailTemplate.js";

export async function getDashboardStats(req, res, next) {
  try {
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1
    );

    const [
      totalBooks,
      totalCustomers,
      totalSellers,
      totalOrders,
      pendingApplications,
      outOfStockBooks,
      lowStockBooks,
      deliveredSalesResult,
      collectedPaymentsResult,
      pendingPaymentsResult,
      deliveredOrdersCount,
      paidOrdersCount,
      pendingPaymentOrdersCount,
      blockedUsers,
      monthlySales,
      recentOrders,
      lowStockItems,
      pendingApplicationItems,
    ] = await Promise.all([
      Book.countDocuments(),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "seller" }),
      Order.countDocuments(),
      User.countDocuments({ sellerApplicationStatus: "pending" }),
      Book.countDocuments({ stock: 0 }),
      Book.countDocuments({ stock: { $gt: 0, $lte: 5 } }),

      // Total value of delivered orders.
      Order.aggregate([
        { $match: { orderStatus: "delivered" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Total value of orders recorded as paid.
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Total value of orders still awaiting payment.
      Order.aggregate([
        { $match: { paymentStatus: "pending" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      Order.countDocuments({ orderStatus: "delivered" }),
      Order.countDocuments({ paymentStatus: "paid" }),
      Order.countDocuments({ paymentStatus: "pending" }),

      User.countDocuments({
        role: { $in: ["user", "seller"] },
        isActive: false,
      }),

      // Monthly delivered sales grouped by order creation month.
      Order.aggregate([
        {
          $match: {
            orderStatus: "delivered",
            createdAt: { $gte: monthStart, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            total: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Order.find()
        .select(
          "orderNumber user totalAmount orderStatus paymentStatus paymentMethod createdAt"
        )
        .populate("user", "name email profileImage")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),

      Book.find({ stock: { $lte: 5 } })
        .select("title author stock price coverImage")
        .sort({ stock: 1, title: 1 })
        .limit(6)
        .lean(),

      User.find({ sellerApplicationStatus: "pending" })
        .select("name email sellerApplicationReason sellerAppliedAt")
        .sort({ sellerAppliedAt: 1 })
        .limit(5)
        .lean(),
    ]);

    const salesByMonth = new Map(
      monthlySales.map((item) => [
        `${item._id.year}-${item._id.month}`,
        item,
      ])
    );

    const salesChart = [];

    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1
      );

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const item = salesByMonth.get(`${year}-${month}`);

      salesChart.push({
        year,
        month,
        label: date.toLocaleString("en", {
          month: "short",
          year: "numeric",
        }),
        total: item?.total ?? 0,
        orders: item?.orders ?? 0,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalBooks,
          totalCustomers,
          totalSellers,
          totalOrders,
          pendingApplications,
          outOfStockBooks,
          lowStockBooks,

          deliveredSales: deliveredSalesResult[0]?.total ?? 0,
          collectedPayments: collectedPaymentsResult[0]?.total ?? 0,
          pendingPayments: pendingPaymentsResult[0]?.total ?? 0,

          deliveredOrdersCount,
          paidOrdersCount,
          pendingPaymentOrdersCount,
          blockedUsers,
        },
        salesChart,
        recentOrders,
        lowStockItems,
        pendingApplicationItems,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/users
// Lists reader and seller accounts for admin management.
export async function getAdminUsers(req, res, next) {
  try {
    const { role, status, search = "" } = req.query;

    const filter = {
      role: { $in: ["user", "seller"] },
    };

    if (role && ["user", "seller"].includes(role)) {
      filter.role = role;
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "blocked") {
      filter.isActive = false;
    }

    const searchText = String(search).trim();

    if (searchText) {
      const escaped = searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select(
        "_id name email role profileImage isActive sellerApplicationStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/users/:userId/status
// Body: { "isActive": false } to block, true to unblock.
export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: 'Provide "isActive" as true or false.',
      });
    }

    if (String(req.user._id) === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot block or unblock your own account here.",
      });
    }

    const targetUser = await User.findById(userId).select(
      "_id name email role isActive"
    );

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!["user", "seller"].includes(targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Administrator accounts cannot be changed here.",
      });
    }

    if (targetUser.isActive === isActive) {
      return res.status(200).json({
        success: true,
        message: isActive
          ? "This account is already active."
          : "This account is already blocked.",
        data: {
          user: {
            _id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            isActive: targetUser.isActive,
          },
        },
      });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    let emailSent = false;

    try {
      const blocked = !isActive;
      const template = blocked
        ? emailTemplates.user_blocked
        : emailTemplates.user_unblocked;

      const subject = blocked
        ? "Your Readify account has been blocked"
        : "Your Readify account has been restored";

      await sendBlockUnblockEmail(
        targetUser.email,
        subject,
        template,
        {
          name: targetUser.name,
          reason: blocked
            ? "Your account has been restricted by an administrator."
            : "",
        },
        blocked
      );

      emailSent = true;
    } catch (emailError) {
      console.error(
        "Account status changed, but notification email failed:",
        emailError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: isActive
        ? "Account unblocked successfully."
        : "Account blocked successfully.",
      data: {
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          isActive: targetUser.isActive,
        },
        emailSent,
      },
    });
  } catch (error) {
    next(error);
  }
}
