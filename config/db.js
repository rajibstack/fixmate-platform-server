const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME || "fixmateDB");
    console.log("Connected to MongoDB successfully!");
  }
  return db;
}

function getCollections() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return {
    usersCollection: db.collection("user"),
    servicesCollection: db.collection("services"),
    bookingsCollection: db.collection("bookings"),
    paymentsCollection: db.collection("payments"),
  };
}

module.exports = { connectDB, getCollections, client };