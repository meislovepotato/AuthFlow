import fs from "fs";
import path from "path";
import Sequelize from "sequelize";
import { fileURLToPath } from "url";
import configJson from "../config/config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env.NODE_ENV || "development";
const config = configJson[env];

const db = {};
const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable], config)
  : new Sequelize(config.database, config.username, config.password, config);

const files = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".js") && file !== path.basename(__filename));

for (const file of files) {
  const module = await import(path.join(__dirname, file));
  const model = module.default(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
}

Object.values(db).forEach((model) => model.associate && model.associate(db));

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
