const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    serviceTitle: {
      type: String,
      required: true,
      trim: true,
    },
    serviceCategory: {
      type: String,
      default: "General Repair",
      trim: true,
    },
    serviceMode: {
      type: String,
      default: "Home Visit",
      trim: true,
    },
    serviceArea: {
      type: String,
      default: "",
      trim: true,
    },
    startingPrice: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    estimatedDuration: {
      type: String,
      default: "1-2 hours",
    },
    serviceImage: {
      type: String,
      default: "",
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    technicianName: {
      type: String,
      required: true,
      trim: true,
    },
    technicianEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    technicianPhone: {
      type: String,
      default: "",
    },
    technicianArea: {
      type: String,
      default: "",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    preferredDate: {
      type: String,
      required: true,
    },
    problemDescription: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "requested",
        "accepted",
        "in-progress",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "requested",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    transactionId: {
      type: String,
      default: "",
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);