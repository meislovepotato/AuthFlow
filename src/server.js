// src/server.js

import app from "./app.js";
import db from "./database/index.js";

const start = async () => {
  await db.sequelize.authenticate();
  console.log("✅ DB Connected");

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
};

start();
