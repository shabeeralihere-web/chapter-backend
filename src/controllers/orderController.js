
import mongoose from "mongoose";
import crypto from "node:crypto";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Book from "../models/Book.js";

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function generateOrderNumber() {
  return `BS-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function validateShippingAddress(address) {
  const requiredFields = [
    "fullName",
    "phone",
    "addressLine1",
    "city",
    "state",
    "postalCode",
    "country",
  ];

  if (
    !address ||
    typeof address !== "object" ||
    Array.isArray(address)
  ) {
    return "Shipping address is required";
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

  for (const field of requiredFields) {
    if (
      typeof address[field] !== "string" ||
      !address[field].trim()
    ) {
      return `${field} is required`;
    }
  }

  for (const [field, maxLength] of Object.entries(limits)) {
    if (
      address[field] !== undefined &&
      (typeof address[field] !== "string" ||
        address[field].trim().length > maxLength)
    ) {
      return `${field} must be a string of at most ${maxLength} characters`;
    }
  }

  return null;
}

// A seller cannot purchase their own books.
// Admin-created books have seller: null.
function isOwnBook(book, user) {
  if (!book || !user || user.role !== "seller" || !book.seller) {
    return false;
  }

  const sellerId = book.seller._id
    ? book.seller._id.toString()
    : book.seller.toString();

  return sellerId === user._id.toString();
}

// Calculate the overall order status from every item's status.
// This prevents one seller from marking a multi-seller order
// as shipped or delivered while other items are still pending.
function calculateOrderStatus(items) {
  if (!items?.length) return "placed";

  const statuses = items.map(
    (item) => item.fulfillmentStatus || "placed"
  );

  if (statuses.every((status) => status === "cancelled")) {
    return "cancelled";
  }

  if (statuses.every(
    (status) => status === "delivered" || status === "cancelled"
  )) {
    return "delivered";
  }

  if (statuses.some((status) => status === "shipped")) {
    return "shipped";
  }

  if (statuses.some((status) => status === "processing")) {
    return "processing";
  }

  if (statuses.some((status) => status === "confirmed")) {
    return "confirmed";
  }

  return "placed";
}

// POST /api/orders/checkout
export async function checkout(req, res, next) {
  let session;

  try {
    const addressError = validateShippingAddress(
      req.body?.shippingAddress
    );

    if (addressError) {
      return sendError(res, 400, addressError);
    }

    const paymentMethod = req.body?.paymentMethod;

    if (!["cod", "online"].includes(paymentMethod)) {
      return sendError(
        res,
        400,
        "Payment method must be cod or online"
      );
    }

    if (paymentMethod === "online") {
      return sendError(
        res,
        400,
        "Online payment is not configured yet. Use cod for now."
      );
    }

    session = await mongoose.startSession();

    let createdOrder;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({
        user: req.user._id,
      }).session(session);

      if (!cart || cart.items.length === 0) {
        const error = new Error("Your cart is empty");
        error.status = 400;
        throw error;
      }

      const orderItems = [];
      let subtotal = 0;

      for (const cartItem of cart.items) {
        if (
          !cartItem.book ||
          !mongoose.isValidObjectId(cartItem.book)
        ) {
          const error = new Error(
            "Your cart contains an invalid book. Please update your cart."
          );
          error.status = 409;
          throw error;
        }

        if (
          !Number.isInteger(cartItem.quantity) ||
          cartItem.quantity < 1 ||
          cartItem.quantity > 99
        ) {
          const error = new Error(
            "Your cart contains an invalid quantity."
          );
          error.status = 400;
          throw error;
        }

        const book = await Book.findById(
          cartItem.book
        ).session(session);

        if (!book) {
          const error = new Error(
            "A book in your cart no longer exists. Please update your cart."
          );
          error.status = 409;
          throw error;
        }

        if (isOwnBook(book, req.user)) {
          const error = new Error(
            `You cannot purchase your own book: "${book.title}". Please remove it from your cart.`
          );
          error.status = 403;
          throw error;
        }

        if (
          !Number.isFinite(book.price) ||
          book.price < 0 ||
          book.stock < cartItem.quantity
        ) {
          const error = new Error(
            `Insufficient stock or invalid price for "${book.title}". Please update your cart.`
          );
          error.status = 409;
          throw error;
        }

        const updatedBook = await Book.findOneAndUpdate(
          {
            _id: book._id,
            stock: { $gte: cartItem.quantity },
          },
          {
            $inc: {
              stock: -cartItem.quantity,
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          }
        );

        if (!updatedBook) {
          const error = new Error(
            `Insufficient stock for "${book.title}". Please try again.`
          );
          error.status = 409;
          throw error;
        }

        const itemSubtotal = Number(
          (book.price * cartItem.quantity).toFixed(2)
        );

        subtotal += itemSubtotal;

        orderItems.push({
          book: book._id,
          title: book.title,
          author: book.author,
          coverImage: book.coverImage || "",
          quantity: cartItem.quantity,
          price: book.price,
          seller: book.seller || null,
          fulfillmentStatus: "placed",
        });
      }

      subtotal = Number(subtotal.toFixed(2));

      const shippingFee = 0;
      const totalAmount = Number(
        (subtotal + shippingFee).toFixed(2)
      );

      const [order] = await Order.create(
        [
          {
            orderNumber: generateOrderNumber(),
            user: req.user._id,
            items: orderItems,
            shippingAddress: {
              fullName: req.body.shippingAddress.fullName.trim(),
              phone: req.body.shippingAddress.phone.trim(),
              addressLine1:
                req.body.shippingAddress.addressLine1.trim(),
              addressLine2:
                req.body.shippingAddress.addressLine2?.trim() || "",
              city: req.body.shippingAddress.city.trim(),
              state: req.body.shippingAddress.state.trim(),
              postalCode:
                req.body.shippingAddress.postalCode.trim(),
              country: req.body.shippingAddress.country.trim(),
            },
            subtotal,
            shippingFee,
            totalAmount,
            paymentMethod: "cod",
            paymentStatus: "pending",
            orderStatus: "placed",
          },
        ],
        { session }
      );

      cart.items = [];
      await cart.save({ session });

      createdOrder = order;
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: createdOrder,
    });
  } catch (error) {
    if (error.status) {
      return sendError(res, error.status, error.message);
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

// GET /api/orders
export async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/orders/:orderId
export async function getOrderById(req, res, next) {
  try {
    const { orderId } = req.params;

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    const isOwner =
      order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return sendError(
        res,
        403,
        "You are not allowed to view this order"
      );
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/orders/:orderId/cancel
export async function cancelOrder(req, res, next) {
  let session;

  try {
    const { orderId } = req.params;

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, 400, "Invalid order ID");
    }

    session = await mongoose.startSession();

    let result;

    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        user: req.user._id,
      }).session(session);

      if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        throw error;
      }

      if (order.orderStatus !== "placed") {
        const error = new Error(
          "Only orders with placed status can be cancelled"
        );
        error.status = 409;
        throw error;
      }

      if (order.paymentStatus === "paid") {
        const error = new Error(
          "This order has been paid. A refund workflow is required."
        );
        error.status = 409;
        throw error;
      }

      for (const item of order.items) {
        await Book.updateOne(
          { _id: item.book },
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      order.orderStatus = "cancelled";

      for (const item of order.items) {
        item.fulfillmentStatus = "cancelled";
      }

      await order.save({ session });
      result = order;
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return sendError(res, error.status, error.message);
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

// GET /api/orders/seller/orders
// Return only the authenticated seller's order items.
export async function getSellerOrders(req, res, next) {
  try {
    if (req.user.role !== "seller") {
      return sendError(res, 403, "Seller access required");
    }

    const orders = await Order.find({
      "items.seller": req.user._id,
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const sellerId = req.user._id.toString();

    const sellerOrders = orders
      .map((order) => {
        const sellerItems = order.items.filter(
          (item) =>
            item.seller &&
            item.seller.toString() === sellerId
        );

        if (sellerItems.length === 0) return null;

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,

          buyer: order.user
            ? {
                _id: order.user._id,
                name: order.user.name,
                email: order.user.email,
              }
            : null,

          // Returned only for orders containing this seller's items.
          shippingAddress: order.shippingAddress,

          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,

          // Do not expose another seller's items.
          items: sellerItems.map((item) => ({
            book: item.book,
            title: item.title,
            author: item.author,
            coverImage: item.coverImage,
            quantity: item.quantity,
            price: item.price,
            fulfillmentStatus:
              item.fulfillmentStatus || "placed",
            itemTotal: Number(
              (item.price * item.quantity).toFixed(2)
            ),
          })),

          sellerSubtotal: Number(
            sellerItems
              .reduce(
                (total, item) =>
                  total + item.price * item.quantity,
                0
              )
              .toFixed(2)
          ),
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      count: sellerOrders.length,
      data: sellerOrders,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/orders/seller/:orderId/items/:bookId/status
// Update a specific book's fulfillment status.
export async function updateSellerItemStatus(req, res, next) {
  try {
    if (req.user.role !== "seller") {
      return sendError(res, 403, "Seller access required");
    }

    const { orderId, bookId } = req.params;
    const { status } = req.body || {};

    if (
      !mongoose.isValidObjectId(orderId) ||
      !mongoose.isValidObjectId(bookId)
    ) {
      return sendError(res, 400, "Invalid order ID or book ID");
    }

    const allowedStatuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return sendError(
        res,
        400,
        "Status must be confirmed, processing, shipped, or delivered"
      );
    }

    const order = await Order.findOne({
      _id: orderId,
      "items.book": bookId,
      "items.seller": req.user._id,
    });

    if (!order) {
      return sendError(
        res,
        404,
        "Order item not found for this seller"
      );
    }

    const item = order.items.find(
      (entry) =>
        entry.book.toString() === bookId &&
        entry.seller &&
        entry.seller.toString() === req.user._id.toString()
    );

    if (!item) {
      return sendError(
        res,
        404,
        "You do not own this order item"
      );
    }

    const currentStatus = item.fulfillmentStatus || "placed";

    const transitions = {
      placed: ["confirmed"],
      confirmed: ["processing"],
      processing: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    if (!transitions[currentStatus]?.includes(status)) {
      return sendError(
        res,
        409,
        `Cannot change item status from ${currentStatus} to ${status}`
      );
    }

    item.fulfillmentStatus = status;

    // Recalculate the order status across all sellers' items.
    // This is a derived overall status, not a seller-only status.
    order.orderStatus = calculateOrderStatus(order.items);

    // Only mark COD paid when the entire order is delivered.
    if (
      order.orderStatus === "delivered" &&
      order.paymentMethod === "cod"
    ) {
      order.paymentStatus = "paid";
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Book marked as ${status}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        item: {
          book: item.book,
          title: item.title,
          fulfillmentStatus: item.fulfillmentStatus,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/orders/seller/inventory
// Return the authenticated seller's books and stock.
export async function getSellerInventory(req, res, next) {
  try {
    if (req.user.role !== "seller") {
      return sendError(res, 403, "Seller access required");
    }

    const books = await Book.find({
      seller: req.user._id,
    })
      .select("title author price stock category coverImage")
      .sort({ title: 1 })
      .lean();

    const totalBooks = books.length;

    const totalStock = books.reduce(
      (total, book) => total + (book.stock || 0),
      0
    );

    const outOfStockBooks = books.filter(
      (book) => (book.stock || 0) === 0
    ).length;

    const lowStockBooks = books.filter(
      (book) => book.stock > 0 && book.stock <= 5
    ).length;

    return res.status(200).json({
      success: true,
      summary: {
        totalBooks,
        totalStock,
        outOfStockBooks,
        lowStockBooks,
      },
      count: books.length,
      data: books,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/orders/admin/all
export async function getAllOrders(req, res, next) {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/orders/admin/:orderId/status
export async function updateOrderStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const orderStatus = req.body?.status ?? req.body?.orderStatus;

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const allowedStatuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (
      typeof orderStatus !== "string" ||
      !allowedStatuses.includes(orderStatus)
    ) {
      return sendError(res, 400, "Invalid order status");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    const transitions = {
      placed: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    const allowedNextStatuses =
      transitions[order.orderStatus] || [];

    if (!allowedNextStatuses.includes(orderStatus)) {
      return sendError(
        res,
        409,
        `Cannot change order status from ${order.orderStatus} to ${orderStatus}`
      );
    }

    // Keep the existing safeguard: admin cancellation needs
    // a dedicated stock-restoration workflow.
    if (orderStatus === "cancelled") {
      return sendError(
        res,
        409,
        "Admin cancellation is not implemented yet. Use the supported cancellation workflow."
      );
    }

    order.orderStatus = orderStatus;

    // Keep item statuses consistent when admin updates the whole order.
    for (const item of order.items) {
      item.fulfillmentStatus = orderStatus;
    }

    if (
      orderStatus === "delivered" &&
      order.paymentMethod === "cod"
    ) {
      order.paymentStatus = "paid";
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
}
