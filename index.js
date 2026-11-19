const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { connectDB } = require("./config/db");
const Service = require("./models/Service");
const User = require("./models/User");
const Booking = require("./models/Booking");

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fixmate_secret_key";

const ContactMessage = require("./models/ContactMessage");

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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Auth & Role Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

const verifyTechnician = (req, res, next) => {
  if (req.user?.role !== "technician") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Technician access required",
    });
  }
  next();
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Admin access required",
    });
  }
  next();
};

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

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const assignedRole = role === "technician" ? "technician" : "customer";

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: assignedRole,
    });

    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        phone: user.phone || "",
        area: user.area || "",
        bio: user.bio || "",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { access_token, role } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: "Google access token is required",
      });
    }

    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const googleUser = await googleRes.json();
    const { sub, email, name, picture } = googleUser;

    let user = await User.findOne({ email });

    if (!user) {
      const assignedRole = role === "technician" ? "technician" : "customer";
      user = await User.create({
        name,
        email,
        googleId: sub,
        avatar: picture || "",
        role: assignedRole,
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Signed in with Google successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        phone: user.phone || "",
        area: user.area || "",
        bio: user.bio || "",
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Get current logged-in user profile
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Update current logged-in user profile (email & role stay locked)
app.patch("/api/auth/profile", verifyToken, async (req, res) => {
  try {
    const { name, phone, area, bio, avatar } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (area !== undefined) user.area = area.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      phone: user.phone || "",
      area: user.area || "",
      bio: user.bio || "",
    };

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Admin: Get all users
app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Admin: Update a user's role (cannot change own role)
app.patch(
  "/api/admin/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;
      const allowedRoles = ["customer", "technician", "admin"];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }

      const targetUser = await User.findById(req.params.id).select("-password");
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const isSelf =
        String(targetUser._id) === String(req.user.userId) ||
        targetUser.email?.toLowerCase() === req.user.email?.toLowerCase();

      if (isSelf) {
        return res.status(400).json({
          success: false,
          message: "Your own role cannot be changed here.",
        });
      }

      targetUser.role = role;
      await targetUser.save();

      res.status(200).json({
        success: true,
        message: "User role updated successfully",
        data: targetUser,
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Admin: Get all services (pending, approved, rejected)
app.get("/api/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const services = await Service.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("Error fetching admin services:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Admin: Get all bookings across the platform (read-only view)
app.get("/api/admin/bookings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching admin bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Admin: Approve or reject a service
app.patch(
  "/api/admin/services/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      service.status = status;
      await service.save();

      res.status(200).json({
        success: true,
        message: `Service marked as ${status}`,
        data: service,
      });
    } catch (error) {
      console.error("Error updating service status:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Public Services (only approved services, or legacy services without status field)
app.get("/api/services", async (req, res) => {
  try {
    const { category } = req.query;
    let query = {
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    };

    if (category && category !== "All") {
      query.category = category;
    }

    const services = await Service.find(query).sort({ createdAt: -1 });
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

// Public Service Details (includes technician profile summary)
app.get("/api/services/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    let technicianSummary = {
      _id: null,
      name: service.technicianName || "Verified Technician",
      email: service.technicianEmail || "",
      avatar: "",
      area: service.area || "",
      bio: "",
      phone: "",
    };

    if (service.technicianEmail) {
      const techUser = await User.findOne({
        email: service.technicianEmail.toLowerCase().trim(),
      }).select("name email avatar area bio phone role");

      if (techUser) {
        technicianSummary = {
          _id: techUser._id,
          name: techUser.name || service.technicianName || "Verified Technician",
          email: techUser.email,
          avatar: techUser.avatar || "",
          area: techUser.area || service.area || "",
          bio: techUser.bio || "",
          phone: techUser.phone || "",
        };
      }
    }

    res.status(200).json({
      success: true,
      data: service,
      technician: technicianSummary,
    });
  } catch (error) {
    console.error("Error fetching service details:", error);
    if (error?.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Customer: Create a repair booking request
app.post("/api/bookings", verifyToken, async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can request a repair",
      });
    }

    const { serviceId, phone, address, preferredDate, problemDescription } =
      req.body;

    if (!serviceId || !phone || !address || !preferredDate || !problemDescription) {
      return res.status(400).json({
        success: false,
        message:
          "Phone, address, preferred date, and problem description are required.",
      });
    }

    const trimmedDesc = String(problemDescription).trim();
    if (trimmedDesc.length < 20) {
      return res.status(400).json({
        success: false,
        message: "Problem description must be at least 20 characters.",
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (String(preferredDate) < todayStr) {
      return res.status(400).json({
        success: false,
        message: "Preferred date must be today or a future date.",
      });
    }

    const service = await Service.findById(serviceId);
    const isApproved =
      (service?.status || "approved").toString().toLowerCase() === "approved";
    const isAvailable = service?.available !== false;

    if (!service || !isApproved || !isAvailable) {
      return res.status(404).json({
        success: false,
        message: "This service is unavailable or not found.",
      });
    }

    const customer = await User.findById(req.user.userId).select(
      "name email role"
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found.",
      });
    }

    const existingActiveBooking = await Booking.findOne({
      serviceId: service._id,
      customerEmail: customer.email.toLowerCase().trim(),
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingActiveBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active request for this service",
      });
    }

    const techUser = service.technicianEmail
      ? await User.findOne({
          email: service.technicianEmail.toLowerCase().trim(),
        }).select("_id name email phone area")
      : null;

    const newBooking = await Booking.create({
      serviceId: service._id,
      serviceTitle: service.title,
      serviceCategory: service.category,
      serviceMode: service.mode || "Home Visit",
      serviceArea: service.area || "",
      startingPrice: Number(service.price || 0),
      estimatedDuration: service.duration || "1-2 hours",
      serviceImage: service.image || "",
      technicianId: techUser?._id || null,
      technicianName: techUser?.name || service.technicianName || "Technician",
      technicianEmail: (
        techUser?.email ||
        service.technicianEmail ||
        ""
      ).toLowerCase(),
      technicianPhone: techUser?.phone || "",
      technicianArea: techUser?.area || service.area || "",
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email.toLowerCase(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      preferredDate: String(preferredDate).trim(),
      problemDescription: trimmedDesc,
      status: "requested",
      paymentStatus: "unpaid",
    });

    res.status(201).json({
      success: true,
      message: "Repair request submitted successfully.",
      data: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking request:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Customer: Get own bookings
app.get("/api/bookings/my", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [
        { customerId: req.user.userId },
        { customerEmail: (req.user.email || "").toLowerCase().trim() },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching customer bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Customer: Cancel a booking while status is "requested"
app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isOwner =
      String(booking.customerId) === String(req.user.userId) ||
      (booking.customerEmail || "").toLowerCase() ===
        (req.user.email || "").toLowerCase();

    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot cancel this booking",
      });
    }

    if (booking.status !== "requested") {
      return res.status(400).json({
        success: false,
        message: "Only requested bookings can be cancelled.",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking request cancelled successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Customer: Pay for a completed booking
app.post("/api/bookings/:id/pay", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isOwner =
      String(booking.customerId) === String(req.user.userId) ||
      (booking.customerEmail || "").toLowerCase() ===
        (req.user.email || "").toLowerCase();

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only pay for your own booking",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment is available once the repair is completed.",
      });
    }

    if (booking.paymentStatus !== "paid") {
      booking.paymentStatus = "paid";
      if (!booking.transactionId) {
        booking.transactionId = `pi_${Date.now()
          .toString(36)
          .toUpperCase()}${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;
      }
      booking.paidAt = new Date();
      await booking.save();
    }

    res.status(200).json({
      success: true,
      message: "Payment completed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error processing booking payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Technician: Get bookings assigned to logged-in technician
app.get(
  "/api/technician/bookings",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const normalizedEmail = (req.user.email || "").toLowerCase().trim();
      const bookings = await Booking.find({
        $or: [
          { technicianId: req.user.userId },
          { technicianEmail: normalizedEmail },
        ],
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (error) {
      console.error("Error fetching technician bookings:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Technician: Move booking status forward one step at a time
app.patch(
  "/api/bookings/:id/status",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const { status } = req.body;
      const nextStatus = (status || "").toString().toLowerCase().trim();

      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const normalizedEmail = (req.user.email || "").toLowerCase().trim();
      const isAssignedTech =
        (booking.technicianId &&
          String(booking.technicianId) === String(req.user.userId)) ||
        (booking.technicianEmail || "").toLowerCase().trim() ===
          normalizedEmail;

      if (!isAssignedTech) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: This booking is not assigned to you",
        });
      }

      const currentStatus = (booking.status || "requested")
        .toString()
        .toLowerCase()
        .trim();

      const allowedTransitions = {
        requested: ["accepted", "rejected"],
        accepted: ["in-progress"],
        "in-progress": ["completed"],
      };

      const validNextStatuses = allowedTransitions[currentStatus] || [];
      if (!validNextStatuses.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from "${currentStatus}" to "${nextStatus}".`,
        });
      }

      booking.status = nextStatus;
      await booking.save();

      res.status(200).json({
        success: true,
        message: `Booking status updated to ${nextStatus}`,
        data: booking,
      });
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Technician: Add a new service (sets status to "pending" for admin approval)
app.post(
  "/api/technician/services",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const {
        title,
        category,
        mode,
        price,
        duration,
        area,
        description,
        image,
        technicianName,
      } = req.body;

      if (!title || !category || !price || !area || !description) {
        return res.status(400).json({
          success: false,
          message: "Title, category, price, area, and description are required.",
        });
      }

      if (Number(price) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be greater than 0.",
        });
      }

      const dbUser = await User.findById(req.user.userId);
      const safeName =
        dbUser?.name || technicianName?.trim() || req.user.email.split("@")[0];
      const safeEmail = dbUser?.email || req.user.email;

      const newService = await Service.create({
        title: title.trim(),
        category: category.trim(),
        mode: mode?.trim() || "Home Visit",
        price: Number(price),
        duration: duration?.trim() || "1-2 hours",
        area: area.trim(),
        description: description.trim(),
        image: image || "",
        technicianName: safeName,
        technicianEmail: safeEmail,
        status: "pending",
        available: true,
      });

      res.status(201).json({
        success: true,
        message: "Service submitted for review.",
        data: newService,
      });
    } catch (error) {
      console.error("Error creating technician service:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Technician: Get own services (for My services page)
app.get(
  "/api/technician/services",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const services = await Service.find({
        technicianEmail: req.user.email,
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: services.length,
        data: services,
      });
    } catch (error) {
      console.error("Error fetching technician services:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Technician: Update own service (edit details or toggle available)
app.patch(
  "/api/technician/services/:id",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      if (service.technicianEmail !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You can only update your own services",
        });
      }

      const allowedFields = [
        "title",
        "category",
        "mode",
        "price",
        "duration",
        "area",
        "description",
        "image",
        "available",
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          service[field] =
            field === "price" ? Number(req.body[field]) : req.body[field];
        }
      }

      const editedCoreFields = [
        "title",
        "category",
        "mode",
        "price",
        "duration",
        "area",
        "description",
        "image",
      ].some((key) => req.body[key] !== undefined);

      if (editedCoreFields && service.status === "approved") {
        service.status = "pending";
      }

      await service.save();

      res.status(200).json({
        success: true,
        message: "Service updated successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error updating technician service:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// Technician: Delete own service
app.delete(
  "/api/technician/services/:id",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      if (service.technicianEmail !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You can only delete your own services",
        });
      }

      await Service.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting technician service:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

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

// Admin: Fetch all contact messages
app.get("/api/admin/messages", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const messages = await ContactMessage.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Admin: Update message status (unread / read / replied)
app.patch(
  "/api/admin/messages/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!["unread", "read", "replied"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      const updated = await ContactMessage.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Message status updated",
        data: updated,
      });
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);