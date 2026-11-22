<div align="center">

# ⚙️ FixMate Server
### Backend REST API for On-Demand Device & Home Appliance Repair Platform

<p align="center">
  <strong>Node.js • Express.js • MongoDB • Role-Based Access • Booking & Payment Workflows</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Runtime-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-REST%20API-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%26%20RBAC-0EA5E9?style=for-the-badge" alt="Auth & RBAC" />
</p>

</div>

---

## 📖 Overview

**FixMate Server** is the backend service powering the **FixMate** repair service platform. It handles authentication, role-based access control (**Customer**, **Technician**, **Admin**), service listings, booking lifecycle management, and payment/invoice data for the Next.js client application.

---

## ✨ Core Capabilities

* **🔐 Authentication & Role Authorization:** User registration, login, token/session verification, and role-based route protection (`customer`, `technician`, `admin`).
* **🛠️ Repair Services Management:** Endpoints to fetch, create, update, and manage repair services, categories, and pricing.
* **📅 Booking & Job Lifecycle:** Create service bookings, prevent conflicting/duplicate schedules, and update job/booking statuses.
* **💳 Payment & Invoice Records:** Store and return payment status, transaction IDs, paid amounts, and timestamps used to generate paid job invoices on the client.
* **🛡️ Centralized Error Handling & CORS:** Consistent JSON error responses, request validation, and cross-origin configuration for the client domain.

---

## 📁 Server Folder Structure

```text
server/
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection setup
│   ├── controllers/
│   │   ├── authController.js     # Login, register, profile handlers
│   │   ├── serviceController.js  # Repair services CRUD handlers
│   │   └── bookingController.js  # Booking creation, status & payment handlers
│   ├── middleware/
│   │   ├── authMiddleware.js     # Token verification & role checks
│   │   └── errorMiddleware.js    # Centralized error & 404 handlers
│   ├── models/
│   │   ├── User.js               # User schema & role definition
│   │   ├── Service.js            # Repair service schema
│   │   └── Booking.js            # Booking & payment details schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── serviceRoutes.js
│   │   └── bookingRoutes.js
│   └── app.js                    # Express app, middleware & route mounting
├── .env.example
├── package.json
└── server.js                     # Entry point & server listener