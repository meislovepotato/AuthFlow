// src/server.js

import app from "./app.js";
import db from "./database/index.js";

const start = async () => {
  await db.sequelize.authenticate();
  console.log("✅ DB Connected");

  app.listen(3000, () => {
    console.log("🚀 Server running");
  });
};

start();
