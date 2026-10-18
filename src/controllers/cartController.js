
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Book from "../models/Book.js";

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function emptyCartResponse() {
  return {
    items: [],
    summary: {
      totalItems: 0,
      subtotal: 0,
      shippingFee: 0,
      discount: 0,
      totalPrice: 0,
    },
    totalItems: 0,
    totalPrice: 0,
  };
}

// A seller cannot purchase their own book.
// Admin-created books have seller: null and remain purchasable.
function isOwnBook(book, user) {
  if (!book || !user || user.role !== "seller" || !book.seller) {
    return false;
  }

  const bookSellerId =
    book.seller._id?.toString?.() ?? book.seller.toString();

  return bookSellerId === user._id.toString();
}

// Remove books owned by the current seller from an existing cart.
// This also cleans up old cart entries created before the restriction.
async function removeOwnBooksFromCart(cart, user) {
  if (!cart || user.role !== "seller") {
    return false;
  }

  const originalLength = cart.items.length;

  const bookIds = cart.items
    .map((item) => item.book)
    .filter(Boolean);

  const books = await Book.find({
    _id: { $in: bookIds },
    seller: user._id,
  }).select("_id");

  const ownBookIds = new Set(
    books.map((book) => book._id.toString())
  );

  cart.items = cart.items.filter((item) => {
    const bookId = item.book?._id
      ? item.book._id.toString()
      : item.book?.toString?.();

    return !bookId || !ownBookIds.has(bookId);
  });

  if (cart.items.length !== originalLength) {
    await cart.save();
    return true;
  }

  return false;
}

// Calculate totals using prices from the Book documents in MongoDB.
function calculateCart(cart) {
  const items = cart.items
    .map((item) => {
      const book = item.book;

      // A book might have been deleted after being added to the cart.
      if (!book || typeof book.price !== "number") {
        return null;
      }

      const unitPrice = book.price;
      const quantity = item.quantity;
      const itemSubtotal = Number(
        (unitPrice * quantity).toFixed(2)
      );

      return {
        book: {
          _id: book._id,
          title: book.title,
          author: book.author,
          price: unitPrice,
          coverImage: book.coverImage,
          stock: book.stock,
        },
        unitPrice,
        quantity,
        itemSubtotal,
        subtotal: itemSubtotal,
      };
    })
    .filter(Boolean);

  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = Number(
    items
      .reduce((total, item) => total + item.itemSubtotal, 0)
      .toFixed(2)
  );

  const shippingFee = 0;
  const discount = 0;

  const totalPrice = Number(
    (subtotal + shippingFee - discount).toFixed(2)
  );

  return {
    items,
    summary: {
      totalItems,
      subtotal,
      shippingFee,
      discount,
      totalPrice,
    },
    totalItems,
    totalPrice,
  };
}

// GET /api/cart
export async function getCart(req, res, next) {
  try {
    const cart = await Cart.findOne({
      user: req.user._id,
    }).populate(
      "items.book",
      "title author price coverImage stock seller"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: emptyCartResponse(),
      });
    }

    // Remove the seller's own books from their existing cart.
    await removeOwnBooksFromCart(cart, req.user);

    // Populate again because cart.save() may leave references unpopulated
    // in some Mongoose workflows.
    await cart.populate(
      "items.book",
      "title author price coverImage stock seller"
    );

    return res.status(200).json({
      success: true,
      data: calculateCart(cart),
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/cart/items
export async function addToCart(req, res, next) {
  try {
    const { bookId, quantity = 1 } = req.body;

    if (
      typeof bookId !== "string" ||
      !mongoose.isValidObjectId(bookId)
    ) {
      return sendError(res, 400, "A valid bookId is required");
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return sendError(
        res,
        400,
        "Quantity must be an integer between 1 and 99"
      );
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return sendError(res, 404, "Book not found");
    }

    // Enforced on the backend, regardless of frontend behavior.
    if (isOwnBook(book, req.user)) {
      return sendError(
        res,
        403,
        "You cannot add your own book to your cart."
      );
    }

    if (book.stock < 1) {
      return sendError(res, 409, "This book is out of stock");
    }

    let cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
      });
    }

    // Clean up any legacy own-book entries before adding another item.
    await removeOwnBooksFromCart(cart, req.user);

    const existingItem = cart.items.find(
      (item) => item.book.toString() === bookId
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    if (newQuantity > 99) {
      return sendError(
        res,
        400,
        "A maximum of 99 copies per book is allowed in the cart"
      );
    }

    if (newQuantity > book.stock) {
      return sendError(
        res,
        409,
        `Only ${book.stock} copies are currently available`
      );
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        book: book._id,
        quantity,
      });
    }

    await cart.save();

    await cart.populate(
      "items.book",
      "title author price coverImage stock seller"
    );

    return res.status(200).json({
      success: true,
      message: "Book added to cart",
      data: calculateCart(cart),
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/cart/items/:bookId
export async function updateCartItem(req, res, next) {
  try {
    const { bookId } = req.params;
    const { quantity } = req.body;

    if (!mongoose.isValidObjectId(bookId)) {
      return sendError(res, 400, "Invalid book ID");
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return sendError(
        res,
        400,
        "Quantity must be an integer between 1 and 99"
      );
    }

    const cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      return sendError(res, 404, "Cart not found");
    }

    const item = cart.items.find(
      (cartItem) => cartItem.book.toString() === bookId
    );

    if (!item) {
      return sendError(res, 404, "Book is not in your cart");
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return sendError(
        res,
        409,
        "This book is no longer available. Remove it from your cart."
      );
    }

    // Do not allow sellers to retain or update their own books in the cart.
    if (isOwnBook(book, req.user)) {
      cart.items = cart.items.filter(
        (cartItem) => cartItem.book.toString() !== bookId
      );

      await cart.save();

      return sendError(
        res,
        403,
        "You cannot purchase your own book. It has been removed from your cart."
      );
    }

    if (book.stock < 1) {
      return sendError(
        res,
        409,
        "This book is currently out of stock"
      );
    }

    if (quantity > book.stock) {
      return sendError(
        res,
        409,
        `Only ${book.stock} copies are currently available`
      );
    }

    item.quantity = quantity;

    await cart.save();

    await cart.populate(
      "items.book",
      "title author price coverImage stock seller"
    );

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated",
      data: calculateCart(cart),
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/cart/items/:bookId
export async function removeCartItem(req, res, next) {
  try {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
      return sendError(res, 400, "Invalid book ID");
    }

    const cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      return sendError(res, 404, "Cart not found");
    }

    const originalLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) => item.book.toString() !== bookId
    );

    if (cart.items.length === originalLength) {
      return sendError(res, 404, "Book is not in your cart");
    }

    await cart.save();

    await cart.populate(
      "items.book",
      "title author price coverImage stock seller"
    );

    return res.status(200).json({
      success: true,
      message: "Book removed from cart",
      data: calculateCart(cart),
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/cart
export async function clearCart(req, res, next) {
  try {
    const cart = await Cart.findOne({
      user: req.user._id,
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is already empty",
        data: emptyCartResponse(),
      });
    }

    cart.items = [];

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: emptyCartResponse(),
    });
  } catch (error) {
    return next(error);
  }
}
