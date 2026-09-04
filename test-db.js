import "dotenv/config";
import { Sequelize } from "sequelize";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  dialectOptions: { ssl: { rejectUnauthorized: false } },
});

try {
  await sequelize.authenticate();
  console.log("Connection successful!");
} catch (err) {
  console.error("Unable to connect:", err);
}
