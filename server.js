require("dotenv").config();
const mongoose = require("mongoose");
const config = require("./config.json");
const dbOptions = {
  
    useNewUrlParser: true,
    useUnifiedTopology: true
  };


mongoose.connect(config.mongodb, dbOptions);
mongoose.Promise = global.Promise;

mongoose.connection.on("connected", () => {
  console.log("DATABASE CONNECTED");

});
mongoose.connection.on("disconnected", () => {
  console.log(`DB IS NOT CONNECTED`);
});

require("./app.js");
console.log("Web is loaded successfully");

let { webhook } = require("./webhook");
