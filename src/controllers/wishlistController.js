
import mongoose from "mongoose";
import Wishlist from "../models/Wishlist.js";
import Book from "../models/Book.js";

const BOOK_FIELDS = "title author price coverImage stock category seller";

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function isOwnBook(book, user) {
  if (!book || !user || user.role !== "seller" || !book.seller) {
    return false;
  }

  const sellerId = book.seller._id
    ? book.seller._id.toString()
    : book.seller.toString();

  return sellerId === user._id.toString();
}

function formatWishlist(wishlist) {
  const books = wishlist?.books ?? [];

  return {
    books,
    totalBooks: books.length,
  };
}

// Remove a seller's own books from an existing wishlist.
// Admin-created books have seller: null and are preserved.
async function removeOwnBooksFromWishlist(wishlist, user) {
  if (!wishlist || user.role !== "seller") {
    return false;
  }

  const bookIds = wishlist.books.map((book) =>
    book?._id ? book._id : book
  );

  const ownBooks = await Book.find({
    _id: { $in: bookIds },
    seller: user._id,
  }).select("_id");

  const ownBookIds = new Set(
    ownBooks.map((book) => book._id.toString())
  );

  const originalLength = wishlist.books.length;

  wishlist.books = wishlist.books.filter((book) => {
    const bookId = book?._id
      ? book._id.toString()
      : book?.toString?.();

    return !bookId || !ownBookIds.has(bookId);
  });

  if (wishlist.books.length !== originalLength) {
    await wishlist.save();
    return true;
  }

  return false;
}

// GET /api/wishlist
export async function getWishlist(req, res, next) {
  try {
    const wishlist = await Wishlist.findOne({
      user: req.user._id,
    }).populate("books", BOOK_FIELDS);

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        data: formatWishlist(null),
      });
    }

    // Clean up own-book entries created before this restriction.
    await removeOwnBooksFromWishlist(wishlist, req.user);

    // Populate again after cleanup to return complete book details.
    await wishlist.populate("books", BOOK_FIELDS);

    return res.status(200).json({
      success: true,
      data: formatWishlist(wishlist),
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/wishlist/:bookId
export async function addToWishlist(req, res, next) {
  try {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
      return sendError(res, 400, "Invalid book ID");
    }

    const book = await Book.findById(bookId).select(
      "_id seller title"
    );

    if (!book) {
      return sendError(res, 404, "Book not found");
    }

    // Enforce ownership on the backend, not just the frontend.
    if (isOwnBook(book, req.user)) {
      return sendError(
        res,
        403,
        "You cannot add your own book to your wishlist."
      );
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      {
        user: req.user._id,
      },
      {
        $setOnInsert: {
          user: req.user._id,
        },
        $addToSet: {
          books: book._id,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).populate("books", BOOK_FIELDS);

    // Also remove any legacy own-book entries.
    await removeOwnBooksFromWishlist(wishlist, req.user);
    await wishlist.populate("books", BOOK_FIELDS);

    return res.status(200).json({
      success: true,
      message: "Book added to wishlist",
      data: formatWishlist(wishlist),
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/wishlist/:bookId
export async function removeFromWishlist(req, res, next) {
  try {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
      return sendError(res, 400, "Invalid book ID");
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      {
        user: req.user._id,
      },
      {
        $pull: {
          books: bookId,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).populate("books", BOOK_FIELDS);

    if (!wishlist) {
      return sendError(res, 404, "Wishlist not found");
    }

    // Keep legacy entries out of seller responses.
    await removeOwnBooksFromWishlist(wishlist, req.user);
    await wishlist.populate("books", BOOK_FIELDS);

    return res.status(200).json({
      success: true,
      message: "Book removed from wishlist",
      data: formatWishlist(wishlist),
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/wishlist
export async function clearWishlist(req, res, next) {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      {
        user: req.user._id,
      },
      {
        $set: {
          books: [],
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is already empty",
        data: {
          books: [],
          totalBooks: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared",
      data: formatWishlist(wishlist),
    });
  } catch (error) {
    return next(error);
  }
}
