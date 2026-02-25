require("dotenv").config();
const express = require("express");
const cors = require("cors");
const transactionsRoutes = require("./routes/transactionsRoutes");
const { authenticate } = require("./middleware/auth"); // reuse your firebase auth
const { requireAdmin } = require("./middleware/auth");  // reuse your firebase auth

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/api/transactions", transactionsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));