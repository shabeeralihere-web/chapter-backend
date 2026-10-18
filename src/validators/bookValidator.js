
import { body, validationResult } from "express-validator";

export const BOOK_CATEGORIES = [
  "Fiction",
  "Mystery & Thriller",
  "Romance",
  "Fantasy",
  "Science Fiction",
  "Biography & Memoir",
  "Self-Help",
  "Business & Economics",
  "Education & Textbooks",
  "History",
  "Philosophy",
  "Poetry",
  "Children's Books",
  "Comics & Graphic Novels",
  "Technology",
  "Other",
];

const validateOptionalNumber = (field, options, message) =>
  body(field)
    .optional({ values: "falsy" })
    .isInt(options)
    .withMessage(message)
    .toInt();

const parseCategories = body("categories")
  .optional({ values: "falsy" })
  .customSanitizer((value) => {
    if (Array.isArray(value)) return value;

    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })
  .custom((value) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error("Choose at least one category.");
    }

    if (value.some((item) => typeof item !== "string")) {
      throw new Error("Please choose valid categories.");
    }

    if (new Set(value).size !== value.length) {
      throw new Error("Remove duplicate categories.");
    }

    if (value.some((item) => !BOOK_CATEGORIES.includes(item))) {
      throw new Error("Please choose categories from the list.");
    }

    return true;
  });

const optionalBookFields = [
  body("pages")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("Page count must be a whole number greater than zero.")
    .toInt(),

  body("isbn")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 20 })
    .withMessage("ISBN cannot exceed 20 characters."),

  body("publisher")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 150 })
    .withMessage("Publisher name cannot exceed 150 characters."),

  validateOptionalNumber(
    "publicationYear",
    { min: 1000, max: 2100 },
    "Enter a valid publication year."
  ),

  body("language")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 50 })
    .withMessage("Language cannot exceed 50 characters."),

  body("edition")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Edition cannot exceed 100 characters."),

  body("format")
    .optional({ values: "falsy" })
    .isIn(["Paperback", "Hardcover", "eBook", "Audiobook", "Other"])
    .withMessage("Please choose a valid book format."),
];

const commonFields = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Please enter the book title.")
    .isLength({ max: 150 })
    .withMessage("The title cannot exceed 150 characters."),

  body("author")
    .trim()
    .notEmpty()
    .withMessage("Please enter the author's name.")
    .isLength({ max: 100 })
    .withMessage("The author's name cannot exceed 100 characters."),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Please enter a book description.")
    .isLength({ max: 3000 })
    .withMessage("The description cannot exceed 3000 characters."),

  body("price")
    .notEmpty()
    .withMessage("Please enter the price.")
    .bail()
    .isFloat({ min: 0 })
    .withMessage("Enter a valid price.")
    .toFloat(),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Choose at least one category.")
    .isIn(BOOK_CATEGORIES)
    .withMessage("Please choose a category from the list."),

  parseCategories,

  body("coverImage")
    .optional({ values: "falsy" })
    .isURL({ require_protocol: true })
    .withMessage("Please choose a valid book cover image."),

  body("stock")
    .optional({ values: "falsy" })
    .isInt({ min: 0 })
    .withMessage("Available copies must be zero or a positive whole number.")
    .toInt(),

  ...optionalBookFields,
];

const sendValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Please check the book details and try again.",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  next();
};

export const validateCreateBook = [
  ...commonFields,
  sendValidationErrors,
];

export const validateUpdateBook = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("The title cannot be empty.")
    .isLength({ max: 150 })
    .withMessage("The title cannot exceed 150 characters."),

  body("author")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("The author's name cannot be empty.")
    .isLength({ max: 100 })
    .withMessage("The author's name cannot exceed 100 characters."),

  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("The description cannot be empty.")
    .isLength({ max: 3000 })
    .withMessage("The description cannot exceed 3000 characters."),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Enter a valid price.")
    .toFloat(),

  body("category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Choose a category.")
    .isIn(BOOK_CATEGORIES)
    .withMessage("Please choose a category from the list."),

  parseCategories,

  body("coverImage")
    .optional({ values: "falsy" })
    .isURL({ require_protocol: true })
    .withMessage("Please choose a valid book cover image."),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Available copies must be zero or a positive whole number.")
    .toInt(),

  ...optionalBookFields,
  sendValidationErrors,
];
