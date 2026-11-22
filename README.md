<div align="center">

# ⚙️ FixMate Platform Server
### Backend REST API for On-Demand Device & Home Appliance Repair Platform

<p align="center">
  <strong>Node.js • Express.js • MongoDB • JWT & RBAC • Bookings, Reviews & Stripe Payments</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Runtime-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-REST%20API-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%26%20RBAC-0EA5E9?style=for-the-badge" alt="Auth & RBAC" />
</p>

</div>

---

## 📌 Project Name & Purpose

* **Project Name:** **FixMate Platform Server**
* **Purpose:** FixMate Platform Server is the backend REST API powering the **FixMate** on-demand device and home appliance repair service platform. It handles authentication (Email/Password & Google OAuth), role-based access control (**Customer**, **Technician**, **Admin**), service listings with pagination, search, filtering, and sorting, booking status history tracking, customer reviews with dynamic profile avatars, technician Pro plan upgrades, Stripe payments, database seeding, and admin/contact workflows for the Next.js client application.

---

## 🌐 Live URL

* **Server Base URL:** `https://your-fixmate-server-url.vercel.app` *(replace with your live deployment URL; local default: `http://localhost:5000`)*

---

## 🔐 Admin & Demo Credentials

Demo accounts for **Admin**, **Technician**, and **Customer** roles are pre-configured for convenient testing and quick selection on the **Sign In** page.

* **Admin Account**
* **Demo Roles on Sign In Page:** Quick-fill demo credentials are configured on the client Sign In page for **Admin**, **Technician**, and **Customer** roles so reviewers and testers can sign in and explore each role's dashboard and workflows directly.

---

## ✨ Key Features

* **🔐 Authentication & Role-Based Access Control (RBAC):** Supports email/password signup and login with `bcryptjs` password hashing, Google OAuth token verification (`/api/auth/google`), JWT bearer token authentication, demo user lookup (`/api/auth/demo-users`), and role checks (`customer`, `technician`, `admin`).
* **🛠️ Repair Services & Dynamic Ratings:** Public service catalog with server-side pagination, search, category/mode filtering, and sorting (`/api/services`), plus service details (`/api/services/:id`) with recalculated average ratings, review counts, and customer avatars resolved from `User` profiles.
* **📅 Booking & Status History Workflow:** Customers can submit repair requests (with duplicate active-booking protection), cancel requested bookings, and track status progression (`requested` → `accepted` → `in-progress` → `completed` → `paid`, or `cancelled`/`rejected`).
* **⭐ Verified Customer Reviews:** Paid bookings allow customers to submit ratings (1–5) and reviews, updating service rating statistics and exposing public reviews (`/api/reviews`) with customer avatars.
* **👑 Technician Services & Pro Plan:** Technicians can create, update, and delete repair services (subject to free plan limits) and upgrade to the **Pro Technician Plan** via Stripe Checkout or direct activation (`/api/subscriptions/pro/*`).
* **🛡️ Admin Moderation & Support Inbox:** Admins can manage user roles, approve or reject services, inspect bookings and payment revenues, and handle customer contact messages (`/api/contact`, `/api/admin/messages`).
* **🌱 Database Seeding:** Includes seed data (`seed/fixmateSeedData.js`) and a seeding script (`scripts/seed.js`) to populate initial records.

---

## 📦 NPM Packages Used

| Package | Purpose |
| :--- | :--- |
| `express` | Web framework for building REST API routes and middlewares |
| `cors` | Enables cross-origin requests with credentials for allowed client origins |
| `dotenv` | Loads environment variables from `.env` |
| `mongoose` | MongoDB ODM for models, queries, and database connection |
| `bcryptjs` | Hashes and verifies user passwords securely |
| `jsonwebtoken` | Generates and verifies JWT authentication tokens |
| `stripe` | Handles Stripe Checkout sessions and subscription/payment workflows |

---

## 📁 Server Folder Structure

```text
fixmate-platform-server/
├── config/
│   └── db.js                      # MongoDB connection configuration
├── models/
│   ├── Booking.js                   # Booking, status history, payment & review model
│   ├── ContactMessage.js            # Customer contact messages model
│   ├── Payment.js                   # Booking & subscription payment records model
│   ├── Service.js                   # Repair service & rating model
│   └── User.js                      # User schema, roles & Pro plan model
├── scripts/
│   └── seed.js                      # Database seed runner script
├── seed/
│   └── fixmateSeedData.js           # Seed dataset for FixMate platform
├── .env                             # Environment variables (local)
├── .gitignore
├── index.js                         # Express server, middlewares & API routes
├── package-lock.json
├── package.json                     # Dependencies & scripts
└── README.md