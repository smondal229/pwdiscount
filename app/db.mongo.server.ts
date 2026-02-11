import mongoose from "mongoose";

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  // We throw here so misconfiguration fails fast in dev.
  throw new Error("MONGO_URI environment variable is required for MongoDB.");
}

console.log("mongoUri---------------", mongoUri);
// Reuse the same connection across hot reloads in dev.
const globalWithMongoose = globalThis as typeof globalThis & {
  __mongooseConnection?: typeof mongoose;
};

if (!globalWithMongoose.__mongooseConnection) {
  mongoose.set("strictQuery", true);
  void mongoose.connect(mongoUri);
  globalWithMongoose.__mongooseConnection = mongoose;
}

// console.log("globalWithMongoose---------------", globalWithMongoose);
export const mongo = globalWithMongoose.__mongooseConnection;

// Discount configuration schema for “Buy 2, get X% off”
const discountConfigSchema = new mongoose.Schema(
  {
    shopDomain: { type: String, required: true, index: true, unique: true },
    productIds: { type: [String], default: [] },
    discountPercent: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

export const DiscountConfig =
  mongo.models.DiscountConfig ||
  mongo.model("DiscountConfig", discountConfigSchema);

