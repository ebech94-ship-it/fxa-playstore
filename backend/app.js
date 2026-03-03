require("dotenv").config();
const express = require("express");
const cors = require("cors");
const transactionsRoutes = require("./routes/transactionsRoutes");


const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/transactions", transactionsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));