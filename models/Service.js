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
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    technicianName: { type: String, required: true, trim: true },
    technicianEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceSchema.index({ status: 1, available: 1, category: 1, mode: 1 });
serviceSchema.index({ price: 1, createdAt: -1 });
serviceSchema.index({ technicianId: 1 });
serviceSchema.index({ technicianEmail: 1 });

module.exports = mongoose.model("Service", serviceSchema);