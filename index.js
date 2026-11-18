const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB } = require("./config/db");

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send({
    status: "success",
    message: "FixMate Repair Service API Server is running!",
  });
});

async function startServer() {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`FixMate Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();