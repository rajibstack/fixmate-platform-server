const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    mode: { type: String, default: "Home Visit", trim: true },
    price: { type: Number, required: true, min: 1 },
    duration: { type: String, default: "1-2 hours", trim: true },
    area: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    features: { type: [String], default: [] },
    technicianName: { type: String, required: true, trim: true },
    technicianEmail: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Service", serviceSchema);
