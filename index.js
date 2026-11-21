const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { connectDB } = require("./config/db");
const Service = require("./models/Service");
const User = require("./models/User");
const Booking = require("./models/Booking");
const Payment = require("./models/Payment");
const ContactMessage = require("./models/ContactMessage");

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fixmate_secret_key";
const FREE_PLAN_SERVICE_LIMIT = 3;
const PRO_PLAN_MONTHLY_PRICE = Number(process.env.PRO_PLAN_PRICE || 19);

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.warn("Stripe SDK not initialized:", err.message);
  }
}

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

// ==========================================
// Auth & Role Middlewares (Challenge 2)
// ==========================================
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
    req.user = {
      ...decoded,
      role: (decoded?.role || "").toString().toLowerCase().trim(),
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

const verifyCustomer = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Customer access required",
    });
  }
  next();
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

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUserPlan(plan) {
  return String(plan || "free").toLowerCase().trim() === "pro" ? "pro" : "free";
}

function formatSafeUser(user) {
  const plan = normalizeUserPlan(user?.plan);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan,
    isVerifiedPro: user.role === "technician" && plan === "pro",
    proActivatedAt: user.proActivatedAt || null,
    avatar: user.avatar || "",
    phone: user.phone || "",
    area: user.area || "",
    bio: user.bio || "",
  };
}

async function findTechnicianUserRecord(record = {}) {
  const orConditions = [];
  if (record?.technicianId) {
    orConditions.push({ _id: record.technicianId });
  }
  if (record?.technicianEmail) {
    const cleanEmail = String(record.technicianEmail).toLowerCase().trim();
    if (cleanEmail) {
      orConditions.push({ email: cleanEmail });
    }
  }

  if (orConditions.length === 0) {
    return null;
  }

  return User.findOne({ $or: orConditions }).select(
    "_id name email avatar area bio phone role plan"
  );
}

async function fetchUsersByIdAndEmail(records = []) {
  const techIds = new Set();
  const techEmails = new Set();

  for (const item of records) {
    if (item?.technicianId) {
      techIds.add(String(item.technicianId));
    }
    if (item?.technicianEmail) {
      techEmails.add(String(item.technicianEmail).toLowerCase().trim());
    }
  }

  const orQuery = [];
  if (techIds.size > 0) {
    orQuery.push({ _id: { $in: Array.from(techIds) } });
  }
  if (techEmails.size > 0) {
    orQuery.push({ email: { $in: Array.from(techEmails) } });
  }

  const usersById = new Map();
  const usersByEmail = new Map();

  if (orQuery.length > 0) {
    const techUsers = await User.find({ $or: orQuery }).select(
      "_id name email avatar area bio phone plan"
    );
    for (const u of techUsers) {
      usersById.set(String(u._id), u);
      if (u.email) {
        usersByEmail.set(String(u.email).toLowerCase().trim(), u);
      }
    }
  }

  return { usersById, usersByEmail };
}

async function attachLatestTechnicianNames(services = []) {
  if (!Array.isArray(services) || services.length === 0) {
    return [];
  }

  const { usersById, usersByEmail } = await fetchUsersByIdAndEmail(services);

  return services.map((srv) => {
    const obj = typeof srv?.toObject === "function" ? srv.toObject() : { ...srv };
    const idKey = obj.technicianId ? String(obj.technicianId) : "";
    const emailKey = obj.technicianEmail
      ? String(obj.technicianEmail).toLowerCase().trim()
      : "";

    const matchedUser =
      (idKey && usersById.get(idKey)) ||
      (emailKey && usersByEmail.get(emailKey)) ||
      null;

    const latestName =
      matchedUser?.name ||
      obj.technician?.name ||
      obj.technicianName ||
      "Verified Technician";
    const techPlan = normalizeUserPlan(matchedUser?.plan || obj.technicianPlan);
    const isVerifiedPro = techPlan === "pro";

    return {
      ...obj,
      technicianName: latestName,
      technicianPlan: techPlan,
      isVerifiedPro,
      technician: {
        ...(obj.technician && typeof obj.technician === "object"
          ? obj.technician
          : {}),
        _id: matchedUser?._id || obj.technicianId || null,
        name: latestName,
        email: matchedUser?.email || obj.technicianEmail || "",
        avatar: matchedUser?.avatar || obj.technician?.avatar || "",
        area: matchedUser?.area || obj.area || "",
        bio: matchedUser?.bio || obj.technician?.bio || "",
        plan: techPlan,
        isVerifiedPro,
      },
    };
  });
}

async function attachLatestTechnicianNamesToBookings(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return [];
  }

  const { usersById, usersByEmail } = await fetchUsersByIdAndEmail(bookings);

  return bookings.map((booking) => {
    const obj =
      typeof booking?.toObject === "function" ? booking.toObject() : { ...booking };
    const idKey = obj.technicianId ? String(obj.technicianId) : "";
    const emailKey = obj.technicianEmail
      ? String(obj.technicianEmail).toLowerCase().trim()
      : "";

    const matchedUser =
      (idKey && usersById.get(idKey)) ||
      (emailKey && usersByEmail.get(emailKey)) ||
      null;

    const latestName =
      matchedUser?.name ||
      obj.technician?.name ||
      obj.technicianName ||
      "Technician";
    const techPlan = normalizeUserPlan(matchedUser?.plan || obj.technicianPlan);
    const isVerifiedPro = techPlan === "pro";

    return {
      ...obj,
      technicianName: latestName,
      technicianPlan: techPlan,
      isVerifiedPro,
      technician: {
        ...(obj.technician && typeof obj.technician === "object"
          ? obj.technician
          : {}),
        _id: matchedUser?._id || obj.technicianId || null,
        name: latestName,
        email: matchedUser?.email || obj.technicianEmail || "",
        phone: matchedUser?.phone || obj.technicianPhone || "",
        area: matchedUser?.area || obj.technicianArea || "",
        bio: matchedUser?.bio || obj.technician?.bio || "",
        plan: techPlan,
        isVerifiedPro,
      },
    };
  });
}

// ==========================================
// Health / Root Route
// ==========================================
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

// ==========================================
// Auth & User Profile Routes
// ==========================================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const assignedRole = role === "technician" ? "technician" : "customer";

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      plan: "free",
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
      user: formatSafeUser(newUser),
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
        message:
          "This account uses Google sign-in. Please continue with Google.",
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
      user: formatSafeUser(user),
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

    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!googleRes.ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const googleUser = await googleRes.json();
    const { sub, email, name, picture } = googleUser;
    const normalizedEmail = String(email || "").toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const assignedRole = role === "technician" ? "technician" : "customer";
      user = await User.create({
        name,
        email: normalizedEmail,
        googleId: sub,
        avatar: picture || "",
        role: assignedRole,
        plan: "free",
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
      user: formatSafeUser(user),
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

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
      user: formatSafeUser(user),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

async function updateUserProfileHandler(req, res) {
  try {
    const { name, phone, area, bio, avatar } = req.body;

    if (!name || !String(name).trim()) {
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

    const trimmedName = String(name).trim();
    user.name = trimmedName;
    if (phone !== undefined) user.phone = String(phone).trim();
    if (area !== undefined) user.area = String(area).trim();
    if (bio !== undefined) user.bio = String(bio).trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    const normalizedEmail = String(user.email || "").toLowerCase().trim();
    const ownerFilter = {
      $or: [
        { technicianId: user._id },
        ...(normalizedEmail ? [{ technicianEmail: normalizedEmail }] : []),
      ],
    };

    await Promise.all([
      Service.updateMany(ownerFilter, { $set: { technicianName: trimmedName } }),
      Booking.updateMany(ownerFilter, { $set: { technicianName: trimmedName } }),
    ]);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: formatSafeUser(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

app.patch("/api/users/profile", verifyToken, updateUserProfileHandler);
app.patch("/api/auth/profile", verifyToken, updateUserProfileHandler);

// ==========================================
// Technician Pro Plan (Stripe Subscription)
// ==========================================
async function activateTechnicianProPlan(user, meta = {}) {
  const transactionId =
    meta.transactionId ||
    `sub_${Date.now().toString(36).toUpperCase()}${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

  if (meta.stripeSessionId) {
    const existingPayment = await Payment.findOne({
      stripeSessionId: meta.stripeSessionId,
      status: "paid",
    });
    if (existingPayment) {
      return { user, payment: existingPayment, alreadyRecorded: true };
    }
  }

  user.plan = "pro";
  user.proActivatedAt = user.proActivatedAt || new Date();
  if (meta.stripeCustomerId) user.stripeCustomerId = meta.stripeCustomerId;
  if (meta.stripeSubscriptionId) {
    user.stripeSubscriptionId = meta.stripeSubscriptionId;
  }
  await user.save();

  const payment = await Payment.create({
    type: "subscription",
    plan: "pro",
    serviceTitle: "Pro Technician Plan (Monthly)",
    userId: user._id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    amount: Number(meta.amount ?? PRO_PLAN_MONTHLY_PRICE),
    currency: "usd",
    provider: "stripe",
    transactionId,
    stripeSessionId: meta.stripeSessionId || "",
    stripeSubscriptionId:
      meta.stripeSubscriptionId || user.stripeSubscriptionId || "",
    status: "paid",
    paidAt: new Date(),
  });

  return { user, payment, alreadyRecorded: false };
}

app.get(
  "/api/subscriptions/pro/status",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId).select("-password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Technician not found",
        });
      }

      const normalizedEmail = String(user.email || "").toLowerCase().trim();
      const serviceCount = await Service.countDocuments({
        $or: [
          { technicianId: user._id },
          ...(normalizedEmail ? [{ technicianEmail: normalizedEmail }] : []),
        ],
      });

      const plan = normalizeUserPlan(user.plan);
      const isPro = plan === "pro";

      res.status(200).json({
        success: true,
        plan,
        isVerifiedPro: isPro,
        serviceCount,
        serviceLimit: isPro ? null : FREE_PLAN_SERVICE_LIMIT,
        remainingFreeSlots: isPro
          ? null
          : Math.max(0, FREE_PLAN_SERVICE_LIMIT - serviceCount),
        price: PRO_PLAN_MONTHLY_PRICE,
        proActivatedAt: user.proActivatedAt || null,
        user: formatSafeUser(user),
      });
    } catch (error) {
      console.error("Error fetching Pro subscription status:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

app.post(
  "/api/subscriptions/pro/checkout-session",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Technician account not found",
        });
      }

      if (normalizeUserPlan(user.plan) === "pro") {
        return res.status(200).json({
          success: true,
          alreadyPro: true,
          message: "You are already subscribed to the Pro Technician Plan.",
          user: formatSafeUser(user),
        });
      }

      const clientBaseUrl = (
        req.body?.returnUrl ||
        process.env.CLIENT_URL ||
        "http://localhost:3000"
      ).replace(/\/+$/, "");

      if (stripe && process.env.STRIPE_PRO_PRICE_ID) {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          customer_email: user.email,
          line_items: [
            {
              price: process.env.STRIPE_PRO_PRICE_ID,
              quantity: 1,
            },
          ],
          metadata: {
            userId: String(user._id),
            userEmail: user.email,
            plan: "pro",
          },
          success_url: `${clientBaseUrl}/dashboard/technician/services?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientBaseUrl}/dashboard/technician/services?upgrade=cancelled`,
        });

        return res.status(200).json({
          success: true,
          mode: "stripe",
          sessionId: session.id,
          url: session.url,
        });
      }

      const { payment } = await activateTechnicianProPlan(user, {
        amount: PRO_PLAN_MONTHLY_PRICE,
      });

      return res.status(200).json({
        success: true,
        mode: "direct",
        message:
          "Upgraded to Pro Technician Plan! Unlimited services & Verified Pro badge unlocked.",
        transactionId: payment.transactionId,
        payment,
        user: formatSafeUser(user),
      });
    } catch (error) {
      console.error("Pro checkout session error:", error);
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to initiate Pro subscription.",
      });
    }
  }
);

app.post(
  "/api/subscriptions/pro/confirm",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const { sessionId } = req.body || {};
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Technician account not found",
        });
      }

      if (stripe && sessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (
          session.payment_status !== "paid" &&
          session.status !== "complete"
        ) {
          return res.status(400).json({
            success: false,
            message: "Stripe subscription payment is not completed yet.",
          });
        }

        const amountTotal = session.amount_total
          ? Number(session.amount_total) / 100
          : PRO_PLAN_MONTHLY_PRICE;

        const { payment } = await activateTechnicianProPlan(user, {
          amount: amountTotal,
          stripeSessionId: session.id,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : "",
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : "",
          transactionId:
            typeof session.subscription === "string"
              ? session.subscription
              : session.id,
        });

        return res.status(200).json({
          success: true,
          message: "Pro Technician Plan activated successfully.",
          payment,
          user: formatSafeUser(user),
        });
      }

      if (normalizeUserPlan(user.plan) === "pro") {
        return res.status(200).json({
          success: true,
          message: "Pro Technician Plan is active.",
          user: formatSafeUser(user),
        });
      }

      const { payment } = await activateTechnicianProPlan(user, {
        amount: PRO_PLAN_MONTHLY_PRICE,
      });

      return res.status(200).json({
        success: true,
        message: "Pro Technician Plan activated successfully.",
        payment,
        user: formatSafeUser(user),
      });
    } catch (error) {
      console.error("Confirm Pro subscription error:", error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

// ==========================================
// Public Service Routes (Challenge 1)
// ==========================================
app.get("/api/services", async (req, res) => {
  try {
    const { search, q, category, mode, sort } = req.query;
    const andConditions = [
      { $or: [{ status: "approved" }, { status: { $exists: false } }] },
      { $or: [{ available: true }, { available: { $exists: false } }] },
    ];

    const trimmedCategory = (category || "").toString().trim();
    if (trimmedCategory && trimmedCategory.toLowerCase() !== "all") {
      const catLower = trimmedCategory.toLowerCase();
      if (catLower === "ac" || catLower.includes("ac & refrigeration")) {
        andConditions.push({
          category: {
            $regex: "(ac|refrigerator|fridge|cooling)",
            $options: "i",
          },
        });
      } else {
        andConditions.push({
          category: {
            $regex: `^${escapeRegex(trimmedCategory)}$`,
            $options: "i",
          },
        });
      }
    }

    const trimmedMode = (mode || "").toString().trim();
    if (trimmedMode && trimmedMode.toLowerCase() !== "all") {
      andConditions.push({
        mode: {
          $regex: `^${escapeRegex(trimmedMode)}$`,
          $options: "i",
        },
      });
    }

    const searchText = (search || q || "").toString().trim();
    if (searchText) {
      const safePattern = escapeRegex(searchText);
      andConditions.push({
        $or: [
          { title: { $regex: safePattern, $options: "i" } },
          { category: { $regex: safePattern, $options: "i" } },
          { technicianName: { $regex: safePattern, $options: "i" } },
        ],
      });
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price-asc") {
      sortOption = { price: 1, createdAt: -1 };
    } else if (sort === "price-desc") {
      sortOption = { price: -1, createdAt: -1 };
    } else if (sort === "newest") {
      sortOption = { createdAt: -1 };
    }

    const rawServices = await Service.find({ $and: andConditions }).sort(
      sortOption
    );
    const services = await attachLatestTechnicianNames(rawServices);

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

    let technicianSummary = {
      _id: null,
      name: service.technicianName || "Verified Technician",
      email: service.technicianEmail || "",
      avatar: "",
      area: service.area || "",
      bio: "",
      phone: "",
      plan: "free",
      isVerifiedPro: false,
    };

    const techUser = await findTechnicianUserRecord(service);
    if (techUser) {
      const techPlan = normalizeUserPlan(techUser.plan);
      technicianSummary = {
        _id: techUser._id,
        name: techUser.name || service.technicianName || "Verified Technician",
        email: techUser.email || service.technicianEmail || "",
        avatar: techUser.avatar || "",
        area: techUser.area || service.area || "",
        bio: techUser.bio || "",
        phone: techUser.phone || "",
        plan: techPlan,
        isVerifiedPro: techPlan === "pro",
      };
    }

    const serviceObj = service.toObject();
    serviceObj.technicianName = technicianSummary.name;
    serviceObj.technicianPlan = technicianSummary.plan;
    serviceObj.isVerifiedPro = technicianSummary.isVerifiedPro;
    serviceObj.technician = technicianSummary;

    res.status(200).json({
      success: true,
      data: serviceObj,
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

// ==========================================
// Customer Booking & Payment Routes
// ==========================================
app.post("/api/bookings", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { serviceId, phone, address, preferredDate, problemDescription } =
      req.body;

    if (
      !serviceId ||
      !phone ||
      !address ||
      !preferredDate ||
      !problemDescription
    ) {
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

    const normalizedCustomerEmail = customer.email.toLowerCase().trim();

    const existingActiveBooking = await Booking.findOne({
      serviceId: service._id,
      customerEmail: normalizedCustomerEmail,
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingActiveBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active request for this service",
      });
    }

    const techUser = await findTechnicianUserRecord(service);

    const newBooking = await Booking.create({
      serviceId: service._id,
      serviceTitle: service.title,
      serviceCategory: service.category,
      serviceMode: service.mode || "Home Visit",
      serviceArea: service.area || "",
      startingPrice: Number(service.price || 0),
      totalPrice: Number(service.price || 0),
      estimatedDuration: service.duration || "1-2 hours",
      serviceImage: service.image || "",
      technicianId: techUser?._id || service.technicianId || null,
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
      customerEmail: normalizedCustomerEmail,
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

app.get("/api/bookings/my", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const normalizedEmail = (req.user.email || "").toLowerCase().trim();
    const rawBookings = await Booking.find({
      $or: [
        { customerId: req.user.userId },
        { customerEmail: normalizedEmail },
      ],
    }).sort({ createdAt: -1 });
    const bookings = await attachLatestTechnicianNamesToBookings(rawBookings);

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

app.patch(
  "/api/bookings/:id/cancel",
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const normalizedEmail = (req.user.email || "").toLowerCase().trim();
      const isOwner =
        (booking.customerId &&
          String(booking.customerId) === String(req.user.userId)) ||
        (booking.customerEmail || "").toLowerCase().trim() === normalizedEmail;

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot cancel another customer's booking",
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
  }
);

async function processCustomerBookingPayment(req, res) {
  try {
    const bookingId = req.params.id || req.body?.bookingId;
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const normalizedEmail = (req.user.email || "").toLowerCase().trim();
    const isOwner =
      (booking.customerId &&
        String(booking.customerId) === String(req.user.userId)) ||
      (booking.customerEmail || "").toLowerCase().trim() === normalizedEmail;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only pay for your own booking",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment is available only once the repair is completed.",
      });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been paid.",
      });
    }

    const amount = Number(
      booking.finalAmount || booking.totalPrice || booking.startingPrice || 0
    );
    const transactionId = `pi_${Date.now()
      .toString(36)
      .toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    booking.paymentStatus = "paid";
    booking.paidAmount = amount;
    booking.transactionId = transactionId;
    booking.paidAt = new Date();
    await booking.save();

    await Payment.create({
      type: "booking",
      plan: "",
      bookingId: booking._id,
      serviceTitle: booking.serviceTitle || "Repair Service",
      userId: booking.customerId || req.user.userId,
      userName: booking.customerName || "Customer",
      userEmail: booking.customerEmail || normalizedEmail,
      userRole: "customer",
      amount,
      currency: "usd",
      provider: "stripe",
      transactionId,
      status: "paid",
      paidAt: booking.paidAt,
    });

    res.status(200).json({
      success: true,
      message: "Payment completed successfully",
      transactionId,
      data: booking,
    });
  } catch (error) {
    console.error("Error processing booking payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

app.post(
  "/api/payments/create-checkout-session",
  verifyToken,
  verifyCustomer,
  processCustomerBookingPayment
);
app.post(
  "/api/bookings/:id/pay",
  verifyToken,
  verifyCustomer,
  processCustomerBookingPayment
);

// ==========================================
// Technician Booking & Service Routes
// ==========================================
async function getTechnicianBookingsHandler(req, res) {
  try {
    const normalizedEmail = (req.user.email || "").toLowerCase().trim();
    const rawBookings = await Booking.find({
      $or: [
        { technicianId: req.user.userId },
        { technicianEmail: normalizedEmail },
      ],
    }).sort({ createdAt: -1 });
    const bookings = await attachLatestTechnicianNamesToBookings(rawBookings);

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

app.get(
  "/api/bookings/technician",
  verifyToken,
  verifyTechnician,
  getTechnicianBookingsHandler
);
app.get(
  "/api/technician/bookings",
  verifyToken,
  verifyTechnician,
  getTechnicianBookingsHandler
);

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

async function createTechnicianServiceHandler(req, res) {
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
    const safeEmail = (dbUser?.email || req.user.email).toLowerCase().trim();
    const currentPlan = normalizeUserPlan(dbUser?.plan);

    if (currentPlan !== "pro") {
      const existingServiceCount = await Service.countDocuments({
        $or: [
          { technicianId: req.user.userId },
          ...(safeEmail ? [{ technicianEmail: safeEmail }] : []),
        ],
      });

      if (existingServiceCount >= FREE_PLAN_SERVICE_LIMIT) {
        return res.status(403).json({
          success: false,
          code: "FREE_PLAN_LIMIT_REACHED",
          plan: "free",
          limit: FREE_PLAN_SERVICE_LIMIT,
          currentCount: existingServiceCount,
          message: `Free technicians can list up to ${FREE_PLAN_SERVICE_LIMIT} services. Upgrade to the Pro Technician Plan for unlimited services and a Verified Pro badge.`,
        });
      }
    }

    const newService = await Service.create({
      title: String(title).trim(),
      category: String(category).trim(),
      mode: mode ? String(mode).trim() : "Home Visit",
      price: Number(price),
      duration: duration ? String(duration).trim() : "1-2 hours",
      area: String(area).trim(),
      description: String(description).trim(),
      image: image || "",
      technicianId: req.user.userId,
      technicianName: safeName,
      technicianEmail: safeEmail,
      status: "pending",
      available: true,
    });

    res.status(201).json({
      success: true,
      message: "Service submitted for review.",
      data: {
        ...newService.toObject(),
        technicianPlan: currentPlan,
        isVerifiedPro: currentPlan === "pro",
      },
    });
  } catch (error) {
    console.error("Error creating technician service:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

app.post(
  "/api/services",
  verifyToken,
  verifyTechnician,
  createTechnicianServiceHandler
);
app.post(
  "/api/technician/services",
  verifyToken,
  verifyTechnician,
  createTechnicianServiceHandler
);

app.get(
  "/api/technician/services",
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const normalizedEmail = (req.user.email || "").toLowerCase().trim();
      const [dbUser, rawServices] = await Promise.all([
        User.findById(req.user.userId).select("plan"),
        Service.find({
          $or: [
            { technicianId: req.user.userId },
            { technicianEmail: normalizedEmail },
          ],
        }).sort({ createdAt: -1 }),
      ]);
      const services = await attachLatestTechnicianNames(rawServices);
      const plan = normalizeUserPlan(dbUser?.plan);

      res.status(200).json({
        success: true,
        count: services.length,
        plan,
        isVerifiedPro: plan === "pro",
        serviceLimit: plan === "pro" ? null : FREE_PLAN_SERVICE_LIMIT,
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

async function updateTechnicianServiceHandler(req, res) {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const normalizedEmail = (req.user.email || "").toLowerCase().trim();
    const isOwner =
      (service.technicianId &&
        String(service.technicianId) === String(req.user.userId)) ||
      (service.technicianEmail || "").toLowerCase().trim() === normalizedEmail;

    if (!isOwner) {
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

app.patch(
  "/api/services/:id",
  verifyToken,
  verifyTechnician,
  updateTechnicianServiceHandler
);
app.patch(
  "/api/technician/services/:id",
  verifyToken,
  verifyTechnician,
  updateTechnicianServiceHandler
);

async function deleteTechnicianServiceHandler(req, res) {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const normalizedEmail = (req.user.email || "").toLowerCase().trim();
    const isOwner =
      (service.technicianId &&
        String(service.technicianId) === String(req.user.userId)) ||
      (service.technicianEmail || "").toLowerCase().trim() === normalizedEmail;

    if (!isOwner) {
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

app.delete(
  "/api/services/:id",
  verifyToken,
  verifyTechnician,
  deleteTechnicianServiceHandler
);
app.delete(
  "/api/technician/services/:id",
  verifyToken,
  verifyTechnician,
  deleteTechnicianServiceHandler
);

// ==========================================
// Admin Routes
// ==========================================
app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users.map((u) => formatSafeUser(u)),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

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
        data: formatSafeUser(targetUser),
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

app.get("/api/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const rawServices = await Service.find({}).sort({ createdAt: -1 });
    const services = await attachLatestTechnicianNames(rawServices);

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

app.get("/api/admin/bookings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const rawBookings = await Booking.find({}).sort({ createdAt: -1 });
    const bookings = await attachLatestTechnicianNamesToBookings(rawBookings);

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

app.get("/api/admin/payments", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [recordedPayments, paidBookings] = await Promise.all([
      Payment.find({ status: "paid" }).sort({ paidAt: -1, createdAt: -1 }),
      Booking.find({ paymentStatus: "paid" }).sort({
        paidAt: -1,
        updatedAt: -1,
      }),
    ]);

    const recordedBookingIds = new Set(
      recordedPayments
        .filter((p) => p.bookingId)
        .map((p) => String(p.bookingId))
    );

    const legacyBookingPayments = paidBookings
      .filter((b) => !recordedBookingIds.has(String(b._id)))
      .map((b) => ({
        _id: b._id,
        type: "booking",
        plan: "",
        bookingId: b._id,
        serviceTitle: b.serviceTitle || "Repair Service",
        userId: b.customerId || null,
        userName: b.customerName || "Customer",
        userEmail: b.customerEmail || "",
        customerName: b.customerName || "Customer",
        customerEmail: b.customerEmail || "",
        technicianName: b.technicianName || "Technician",
        amount: Number(
          b.paidAmount || b.finalAmount || b.totalPrice || b.startingPrice || 0
        ),
        paidAmount: Number(
          b.paidAmount || b.finalAmount || b.totalPrice || b.startingPrice || 0
        ),
        transactionId: b.transactionId || "",
        paymentStatus: "paid",
        status: "paid",
        paidAt: b.paidAt || b.updatedAt,
      }));

    const normalizedRecorded = recordedPayments.map((p) => {
      const obj = p.toObject();
      return {
        ...obj,
        customerName: obj.userName,
        customerEmail: obj.userEmail,
        paidAmount: obj.amount,
        paymentStatus: obj.status,
      };
    });

    const allPayments = [...normalizedRecorded, ...legacyBookingPayments].sort(
      (a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0)
    );

    const totalRevenue = allPayments.reduce(
      (sum, item) => sum + Number(item.amount || item.paidAmount || 0),
      0
    );

    const subscriptionRevenue = normalizedRecorded
      .filter((p) => p.type === "subscription")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    res.status(200).json({
      success: true,
      count: allPayments.length,
      totalRevenue,
      subscriptionRevenue,
      data: allPayments,
    });
  } catch (error) {
    console.error("Error fetching admin payments:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

async function updateServiceApprovalHandler(req, res) {
  try {
    const rawStatus = req.body.status || req.body.approvalStatus;
    const status = String(rawStatus || "").toLowerCase().trim();

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

app.patch(
  "/api/admin/services/:id/approval",
  verifyToken,
  verifyAdmin,
  updateServiceApprovalHandler
);
app.patch(
  "/api/admin/services/:id/status",
  verifyToken,
  verifyAdmin,
  updateServiceApprovalHandler
);

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
        { returnDocument: "after" }
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