const mongoose = require("mongoose");

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      default: "",
      trim: true,
    },
    topic: {
      type: String,
      default: "General Inquiry",
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["unread", "read", "replied"],
      default: "unread",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", contactMessageSchema);