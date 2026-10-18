
import { body, validationResult } from "express-validator";

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  next();
};

export const validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 80 })
    .withMessage("Name cannot exceed 80 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),

  body("password")
    .isString()
    .withMessage("Password must be a string")
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters")
    .matches(/[a-z]/)
    .withMessage("Password must contain a lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain a special character"),

  body("confirmPassword")
    .isString()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),

  handleValidationErrors,
];
