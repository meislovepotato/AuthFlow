require("dotenv").config();

module.exports = {
  development: {
    DATABASE_URL: process.env.DATABASE_URL,
    dialect: "postgres",
  },
};
