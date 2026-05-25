import "dotenv/config";
import { Sequelize } from "sequelize";

let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    dialectOptions: { ssl: { rejectUnauthorized: false } },
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || "mysql",
    },
  );
}

try {
  await sequelize.authenticate();
  console.log("Connection successful!");
} catch (err) {
  console.error("Unable to connect:", err);
}
