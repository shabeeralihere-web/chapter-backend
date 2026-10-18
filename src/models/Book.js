
import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please enter the book title."],
      trim: true,
      maxlength: [150, "The title cannot exceed 150 characters."],
    },
    author: {
      type: String,
      required: [true, "Please enter the author's name."],
      trim: true,
      maxlength: [100, "The author's name cannot exceed 100 characters."],
    },
    description: {
      type: String,
      required: [true, "Please enter a book description."],
      trim: true,
      maxlength: [3000, "The description cannot exceed 3000 characters."],
    },
    price: {
      type: Number,
      required: [true, "Please enter the price."],
      min: [0, "The price cannot be negative."],
      index: true,
    },

    // Keep this field for compatibility with existing books and pages.
    category: {
      type: String,
      required: [true, "Please choose at least one category."],
      trim: true,
      index: true,
    },

    // New books can belong to more than one category.
    categories: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Available copies cannot be negative."],
      validate: {
        validator: Number.isInteger,
        message: "Available copies must be a whole number.",
      },
    },

    // Optional book details.
    pages: {
      type: Number,
      min: [1, "Page count must be at least 1."],
      validate: {
        validator: (value) =>
          value == null || Number.isInteger(value),
        message: "Page count must be a whole number.",
      },
    },
    isbn: {
      type: String,
      trim: true,
      maxlength: [20, "ISBN cannot exceed 20 characters."],
      default: "",
    },
    publisher: {
      type: String,
      trim: true,
      maxlength: [150, "Publisher name cannot exceed 150 characters."],
      default: "",
    },
    publicationYear: {
      type: Number,
      min: [1000, "Enter a valid publication year."],
      max: [2100, "Enter a valid publication year."],
      validate: {
        validator: (value) =>
          value == null || Number.isInteger(value),
        message: "Publication year must be a whole number.",
      },
    },
    language: {
      type: String,
      trim: true,
      maxlength: [50, "Language cannot exceed 50 characters."],
      default: "English",
    },
    edition: {
      type: String,
      trim: true,
      maxlength: [100, "Edition cannot exceed 100 characters."],
      default: "",
    },
    format: {
      type: String,
      enum: {
        values: ["Paperback", "Hardcover", "eBook", "Audiobook", "Other"],
        message: "Please choose a valid book format.",
      },
      default: undefined,
    },

    // Admin-created books can have no seller.
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bookSchema.index({ createdAt: -1 });
bookSchema.index({ seller: 1, createdAt: -1 });
bookSchema.index({ categories: 1 });

const Book = mongoose.model("Book", bookSchema);

export default Book;
