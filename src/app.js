
import express from "express";
import cors from "cors";
import helmet from "helmet";

import bookRoutes from "./routes/bookRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sellerRoutes from "./routes/sellerRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  })
);

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Book Store API is running",
  });
});

app.use("/api/books", bookRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
