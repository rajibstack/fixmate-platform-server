require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/db");
const User = require("../models/User");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const {
  seedUsers,
  seedServices,
  seedBookings,
} = require("../seed/fixmateSeedData");

const SEED_TECH_EMAILS = [
  "tariq.tech@fixmate.app",
  "nadia.tech@fixmate.app",
];

async function runSeed() {
  await connectDB();
  console.log("Connected to MongoDB for fresh seeding...");

  const hashedDefaultPassword = await bcrypt.hash("FixMate@123", 10);
  const userByEmail = new Map();

  for (const userData of seedUsers) {
    const normalizedEmail = userData.email.toLowerCase().trim();
    const doc = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          ...userData,
          email: normalizedEmail,
          password: hashedDefaultPassword,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    userByEmail.set(normalizedEmail, doc);
  }


  await Booking.deleteMany({
    technicianEmail: { $in: SEED_TECH_EMAILS },
  });
  await Service.deleteMany({
    technicianEmail: { $in: SEED_TECH_EMAILS },
  });

  const insertedServices = await Service.insertMany(
    seedServices.map((serviceData) => {
      const techDoc = serviceData.technicianEmail
        ? userByEmail.get(serviceData.technicianEmail.toLowerCase().trim())
        : null;

      return {
        ...serviceData,
        technicianEmail: (serviceData.technicianEmail || "").toLowerCase().trim(),
        ...(techDoc?._id ? { technicianId: techDoc._id } : {}),
      };
    })
  );

  const serviceByTitle = new Map();
  for (const svc of insertedServices) {
    serviceByTitle.set(svc.title, svc);
  }

  const bookingsToInsert = seedBookings.map((bookingData) => {
    const serviceDoc = serviceByTitle.get(bookingData.serviceTitle);
    const techDoc = bookingData.technicianEmail
      ? userByEmail.get(bookingData.technicianEmail.toLowerCase().trim())
      : null;
    const customerDoc = bookingData.customerEmail
      ? userByEmail.get(bookingData.customerEmail.toLowerCase().trim())
      : null;

    return {
      ...bookingData,
      technicianEmail: (bookingData.technicianEmail || "").toLowerCase().trim(),
      customerEmail: (bookingData.customerEmail || "").toLowerCase().trim(),
      ...(serviceDoc?._id ? { serviceId: serviceDoc._id } : {}),
      ...(techDoc?._id ? { technicianId: techDoc._id } : {}),
      ...(customerDoc?._id ? { customerId: customerDoc._id } : {}),
    };
  });

  await Booking.insertMany(bookingsToInsert);

  console.log(
    `Fresh seed complete: ${seedUsers.length} users, ${insertedServices.length} approved services, ${bookingsToInsert.length} bookings.`
  );
  await mongoose.disconnect();
}

runSeed().catch(async (err) => {
  console.error("Seed error:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});