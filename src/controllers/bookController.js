
import mongoose from "mongoose";
import Book from "../models/Book.js";
import cloudinary from "../config/cloudinary.js";

function getCloudinaryPublicId(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  try {
    const url = new URL(imageUrl);

    if (
      url.hostname !== "res.cloudinary.com" ||
      url.protocol !== "https:"
    ) {
      return null;
    }

    const parts = url.pathname.split("/image/upload/");
    if (parts.length !== 2) return null;

    const path = parts[1].replace(/^.*?\/v\d+\//, "");
    const withoutExtension = path.replace(/\.[^/.]+$/, "");

    return decodeURIComponent(withoutExtension);
  } catch {
    return null;
  }
}

async function removeCloudinaryImage(imageUrl) {
  const publicId = getCloudinaryPublicId(imageUrl);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Book cover cleanup failed:", error);
  }
}

async function cleanupNewUpload(req) {
  if (req.file && req.body?.coverImage) {
    await removeCloudinaryImage(req.body.coverImage);
  }
}

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const optionalFields = [
  "pages",
  "isbn",
  "publisher",
  "publicationYear",
  "language",
  "edition",
  "format",
];

const numericOptionalFields = ["pages", "publicationYear"];

function readCategories(body) {
  let categories = body.categories;

  if (typeof categories === "string") {
    try {
      categories = JSON.parse(categories);
    } catch {
      categories = [body.category];
    }
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    categories = body.category ? [body.category] : [];
  }

  return [
    ...new Set(
      categories
        .map((item) => String(item).trim())
        .filter(Boolean)
    ),
  ];
}

// GET /api/books
// Public book catalogue with search, filters, sorting and pagination.
export async function getBooks(req, res, next) {
  try {
    const {
      search = "",
      category,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      order = "desc",
      page = "1",
      limit = "12",
    } = req.query;

    const currentPage = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isSafeInteger(currentPage) ||
      currentPage < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please choose a valid page and page size.",
      });
    }

    if (
      !["title", "author", "price", "createdAt"].includes(sortBy) ||
      !["asc", "desc"].includes(order)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please choose valid sorting options.",
      });
    }

    if (typeof search !== "string" || search.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search must be 100 characters or fewer.",
      });
    }

    if (
      category !== undefined &&
      (typeof category !== "string" || category.trim().length > 80)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please choose a valid category.",
      });
    }

    const filter = {};
    const searchTerm = search.trim();

    if (searchTerm) {
      const expression = new RegExp(escapeRegex(searchTerm), "i");

      filter.$or = [
        { title: expression },
        { author: expression },
      ];
    }

    if (category?.trim()) {
      const expression = new RegExp(
        `^${escapeRegex(category.trim())}$`,
        "i"
      );

      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { category: expression },
            { categories: expression },
          ],
        },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const minimum =
        minPrice === undefined ? undefined : Number(minPrice);

      const maximum =
        maxPrice === undefined ? undefined : Number(maxPrice);

      if (
        (minimum !== undefined &&
          (!Number.isFinite(minimum) || minimum < 0)) ||
        (maximum !== undefined &&
          (!Number.isFinite(maximum) || maximum < 0)) ||
        (minimum !== undefined &&
          maximum !== undefined &&
          minimum > maximum)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid price range.",
        });
      }

      filter.price = {};

      if (minimum !== undefined) {
        filter.price.$gte = minimum;
      }

      if (maximum !== undefined) {
        filter.price.$lte = maximum;
      }
    }

    const skip = (currentPage - 1) * pageSize;
    const direction = order === "asc" ? 1 : -1;

    const sortOptions = {
      [sortBy]: direction,
      _id: direction,
    };

    const [books, totalBooks] = await Promise.all([
      Book.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Book.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: books.length,
      total: totalBooks,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(totalBooks / pageSize),
      data: books,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/books/my-books
// Return only the authenticated seller's books.

export async function getMyBooks(req, res, next) {
  try {
    const currentPage = Number(req.query.page || 1);
    const pageSize = Number(req.query.limit || 12);
    const search = String(req.query.search || "").trim();

    // Validate pagination
    if (
      !Number.isSafeInteger(currentPage) ||
      currentPage < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please choose a valid page and page size.",
      });
    }

    // Validate search input
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search must be 100 characters or fewer.",
      });
    }

    // Sellers can only retrieve their own books
    const filter = {
      seller: req.user._id,
    };

    // Search the seller's books by relevant fields
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { title: expression },
        { author: expression },
        { isbn: expression },
        { category: expression },
        { categories: expression },
      ];
    }

    const skip = (currentPage - 1) * pageSize;

    const [books, totalBooks] = await Promise.all([
      Book.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Book.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: books.length,
      total: totalBooks,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(totalBooks / pageSize),
      data: books,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/books/:id
export async function getBookById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    return res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/books
export async function createBook(req, res, next) {
  try {
    const {
      title,
      author,
      description,
      price,
      coverImage,
      stock,
    } = req.body;

    const categories = readCategories(req.body);

    const optionalData = {};

    for (const field of optionalFields) {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        optionalData[field] = req.body[field];
      }
    }

    const sellerId =
      req.user.role === "seller" ? req.user._id : null;

    const book = await Book.create({
      title,
      author,
      description,
      price,
      category: categories[0],
      categories,
      coverImage,
      stock,
      ...optionalData,
      seller: sellerId,
    });

    return res.status(201).json({
      success: true,
      message: "Book added successfully.",
      data: book,
    });
  } catch (error) {
    await cleanupNewUpload(req);
    next(error);
  }
}

// PATCH /api/books/:id
export async function updateBook(req, res, next) {
  let newImageUrl = null;
  let oldImageUrl = null;

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      await cleanupNewUpload(req);

      return res.status(400).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    const book = await Book.findById(id);

    if (!book) {
      await cleanupNewUpload(req);

      return res.status(404).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    // Sellers may update only their own books.
    if (
      req.user.role === "seller" &&
      (!book.seller ||
        book.seller.toString() !== req.user._id.toString())
    ) {
      await cleanupNewUpload(req);

      return res.status(403).json({
        success: false,
        message: "You can only update your own books.",
      });
    }

    const allowedFields = [
      "title",
      "author",
      "description",
      "price",
      "coverImage",
      "stock",
      ...optionalFields,
    ];

    let updated = false;

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;

      const value = req.body[field];

      if (
        numericOptionalFields.includes(field) &&
        value === ""
      ) {
        book.set(field, undefined);
      } else {
        book.set(field, value);
      }

      updated = true;
    }

    if (
      req.body.categories !== undefined ||
      req.body.category !== undefined
    ) {
      const categories = readCategories(req.body);

      if (categories.length === 0) {
        await cleanupNewUpload(req);

        return res.status(400).json({
          success: false,
          message: "Choose at least one category.",
        });
      }

      book.categories = categories;
      book.category = categories[0];
      updated = true;
    }

    if (!updated) {
      await cleanupNewUpload(req);

      return res.status(400).json({
        success: false,
        message: "Please make at least one change before saving.",
      });
    }

    if (req.file) {
      newImageUrl = req.body.coverImage;
      oldImageUrl = book.coverImage;
    }

    await book.save();

    // Remove the old cover only after saving the new one successfully.
    if (newImageUrl && oldImageUrl !== newImageUrl) {
      await removeCloudinaryImage(oldImageUrl);
    }

    return res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      data: book,
    });
  } catch (error) {
    if (newImageUrl) {
      await removeCloudinaryImage(newImageUrl);
    }

    next(error);
  }
}

// DELETE /api/books/:id
export async function deleteBook(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that book.",
      });
    }

    // Sellers may delete only their own books.
    if (
      req.user.role === "seller" &&
      (!book.seller ||
        book.seller.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own books.",
      });
    }

    const oldImageUrl = book.coverImage;

    await book.deleteOne();
    await removeCloudinaryImage(oldImageUrl);

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}
