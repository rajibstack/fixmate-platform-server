const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { connectDB } = require("./config/db");
const Service = require("./models/Service");

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
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FixMate API Server</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
            .card { background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; max-width: 550px; width: 100%; border: 1px solid #334155; }
            .logo { font-size: 32px; font-weight: 700; color: #38bdf8; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 12px; }
            .logo-icon { width: 42px; height: 42px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2); }
            .logo-icon svg { width: 22px; height: 22px; stroke: #38bdf8; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
            .status-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.1); color: #4ade80; padding: 6px 16px; border-radius: 50px; font-size: 14px; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(34, 197, 94, 0.2); }
            .pulse { width: 10px; height: 10px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); animation: pulse 1.5s infinite; }
            @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
            p { color: #94a3b8; font-size: 15px; margin-bottom: 25px; line-height: 1.5; }
            .endpoints { background: #0f172a; padding: 15px; border-radius: 8px; text-align: left; font-family: monospace; font-size: 13px; color: #38bdf8; border: 1px solid #334155; }
            .endpoints span { color: #cbd5e1; }
            .footer { margin-top: 25px; font-size: 12px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo">
                <div class="logo-icon">
                    <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                </div>
                <span>Fix<span style="color: #ffffff;">Mate</span> API</span>
            </div>
            <div>
                <span class="status-badge">
                    <span class="pulse"></span> Server is Live & Connected
                </span>
            </div>
            <p>Welcome to the official backend engine of FixMate On-Demand Device & Home Appliance Repair Service Platform.</p>
            <div class="endpoints">
                <strong>Base URL:</strong> http://localhost:5000<br>
                <strong>Status Route:</strong> <span>GET /</span><br>
                <strong>Environment:</strong> <span>Development (Node.js)</span>
            </div>
            <div class="footer">Powered by Next.js & Express.js Core • Secure & Fast</div>
        </div>
    </body>
    </html>
  `);
});

app.get("/api/services", async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    
    if (category && category !== "All") {
      query.category = category;
    }

    const services = await Service.find(query);
    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

app.get("/api/services/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error("Error fetching service details:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
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