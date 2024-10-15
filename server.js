const mongoose = require("mongoose");
const dotenv = require("dotenv");

process.on('uncaughtException', err => {
   console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
   console.log(err.name, err.message);
   process.exit(1);
 });

dotenv.config({ path: "./config.env" });
const app = require("./app");

mongoose
  .connect("mongodb://localhost:27017/AuthUser")
  .then(() => {
    console.log("DB connection successful 🥳");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB 💥", err);
  });

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
   console.log('UNHANDLED REJECTION! 💥 Shutting down...');
   console.log(err.name, err.message);
   server.close(() => {
     process.exit(1);
   });
 });