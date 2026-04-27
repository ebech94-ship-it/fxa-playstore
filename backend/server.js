require("dotenv").config();

console.log("🔥 ACTIVE SERVER.JS LOADED 🔥");

const express = require("express");
const cors = require("cors");

// routes
const payinRoutes = require("./routes/payin");
const payoutRoutes = require("./routes/payout");
const tournamentRoutes = require("./routes/tournament");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");

const app = express();

// ----------------------
// CORE MIDDLEWARE
// ----------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/health", (req, res) => {
  res.send("Backend running");
});

// ----------------------
// ROUTES
// ----------------------
app.use("/api/payin", payinRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/tournament", tournamentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

// ----------------------
// ERROR HANDLER
// ----------------------
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log("Routes loaded: payin, payout, tournament, admin");
});