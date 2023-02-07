const mongoose = require("mongoose");

const Options = {
  userID: { type: String, required: true },
  email: { type: String },
  customerId: { type: String },
  badges: { type: Array, default: [] },
  premium: {
    subscription: { type: String, default: false },
    subscriptionType: {
      server: { type: Boolean, default: false },
      custom: { type: Boolean, default: false },
      lifetime: { type: Boolean, default: false },
    },
    expiryTimestamp: { type: Number, default: false },
    servers: {
      totalGuilds: { type: Number, default: false },
      redeemedGuilds: { type: Array, default: [] },
    },
  },
};

const Schema = new mongoose.Schema(Options);

module.exports = mongoose.model("User", Schema);
