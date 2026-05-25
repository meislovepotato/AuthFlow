import "dotenv/config"; // same as require('dotenv').config()
import { Sequelize, DataTypes } from "sequelize";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Recreate __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Sequelize
let sequelize;
if (process.env.DATABASE_URL) {
  // Use a single connection URL when provided (Render Postgres)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        // Render Postgres requires SSL but uses a self-signed cert
        rejectUnauthorized: false,
      },
    },
  });
} else {
  // Fallback to individual env vars (legacy / local)
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || "mysql",
      logging: false,
    },
  );
}

const db = {};

// 📂 Path to Sequelize CLI models folder
const modelsPath = path.join(__dirname, "../../models");

// 🔄 Load all models dynamically
const modelFiles = fs
  .readdirSync(modelsPath)
  .filter(
    (file) =>
      file !== "index.js" && (file.endsWith(".js") || file.endsWith(".cjs")),
  );

for (const file of modelFiles) {
  const modulePath = path.join(modelsPath, file);
  const moduleURL = pathToFileURL(modulePath).href;

  // Dynamic import instead of require
  const { default: modelFactory } = await import(moduleURL);
  const model = modelFactory(sequelize, DataTypes);

  db[model.name] = model;
}

// 🔗 Run associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Export
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
