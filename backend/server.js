const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/db");

// Initialize app
const app = express();

// Connect DB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/post", require("./routes/postRoutes"));
app.use("/api/comment", require("./routes/commentRoutes"));
app.use("/api/like", require("./routes/likeRoutes"));

// ⭐ Serve ALL frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ⭐ FIXED: Only handle unknown routes (NOT including existing files)
app.get("*", (req, res) => {
  // If it's an API route → do NOT send index.html
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }

  // Otherwise serve frontend index
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
