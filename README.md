<div align="center">

# ⚙️ FixMate Server

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

- **Project Name:** **FixMate Server**
- **Purpose:** FixMate Server is the backend REST API powering the **FixMate** on-demand device and home appliance repair service platform. It manages authentication (Email/Password & Google OAuth), role-based access control (**Customer**, **Technician**, **Admin**), service listings with pagination and filtering, booking lifecycle tracking, customer reviews with dynamic avatars, technician Pro plan upgrades, Stripe payments, and contact/admin moderation workflows for the Next.js client application.

---

## 🌐 Live URL

- **Server Base URL:** `https://your-fixmate-server-url.vercel.app` _(replace with your live deployment URL; local default: `http://localhost:5000`)_

---

## 🔑 Admin Credentials

> ⚠️ **Note:** Replace `<YOUR_ADMIN_PASSWORD>` with your actual configured password before publishing or sharing publicly.

- **Email:** `admin@fixmate.app`
- **Password:** `<YOUR_ADMIN_PASSWORD>`
- **Role:** `admin`

---

## ✨ Key Features

- **🔐 Authentication & Role-Based Access Control (RBAC):** Supports email/password signup and login with `bcryptjs` password hashing, Google OAuth token verification (`/api/auth/google`), JWT bearer token authentication, and role middlewares (`customer`, `technician`, `admin`).
- **🛠️ Repair Services & Dynamic Ratings:** Public service listing with server-side pagination, search, category/mode filtering, and sorting (`/api/services`), plus single-service details (`/api/services/:id`) with recalculated average ratings, review counts, and customer avatar resolution from `User` records.
- **📅 Booking & Status History Workflow:** Customers can submit repair requests (preventing duplicate active bookings on the same service), track status history (`requested` → `accepted` → `in-progress` → `completed` → `paid`, or `cancelled`/`rejected`), and cancel requested bookings.
- **⭐ Verified Customer Reviews:** Paid bookings allow customers to submit ratings (1–5) and reviews, automatically recalculating service ratings and exposing public reviews (`/api/reviews`) with customer profile avatars.
- **👑 Technician Management & Pro Plan:** Technicians can create, update, and delete repair services (subject to the free plan service limit) and upgrade to the **Pro Technician Plan** via Stripe Checkout or direct activation (`/api/subscriptions/pro/*`).
- **🛡️ Admin Moderation & Support Inbox:** Admins can manage user roles, approve or reject technician services, inspect all bookings and payment records/revenues, and manage customer contact messages (`/api/contact`, `/api/admin/messages`).

---

## 📦 NPM Packages Used

| Package        | Purpose                                                                   |
| :------------- | :------------------------------------------------------------------------ |
| `express`      | Web framework for building REST API routes and middlewares                |
| `cors`         | Enables cross-origin requests with credentials for allowed client origins |
| `dotenv`       | Loads environment variables from `.env`                                   |
| `mongoose`     | MongoDB ODM for models, queries, and database connection                  |
| `bcryptjs`     | Hashes and verifies user passwords securely                               |
| `jsonwebtoken` | Generates and verifies JWT authentication tokens                          |
| `stripe`       | Handles Stripe Checkout sessions and subscription/payment workflows       |

---

## 📁 Server Folder Structure

```text
server/
├── config/
│   └── db.js                 # MongoDB connection setup
├── models/
│   ├── User.js               # User schema, roles & Pro plan fields
│   ├── Service.js            # Repair service & rating schema
│   ├── Booking.js            # Booking, status history, payment & review schema
│   ├── Payment.js            # Booking & subscription payment records
│   └── ContactMessage.js     # Customer contact messages schema
├── .env.example              # Environment variable template
├── index.js                  # Express server, middlewares & API routes
└── package.json              # Dependencies & scripts
```
