#!/usr/bin/env node
import "dotenv/config";
import mysql from "mysql2/promise";

async function run() {
  const cfg = {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "authflow_db",
  };

  console.log("Connecting to DB", cfg.host, cfg.database);
  const conn = await mysql.createConnection(cfg);
  try {
    console.log("Checking for existing columns...");
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Users' AND COLUMN_NAME IN ('failedLoginAttempts','lockedUntil')`,
      [cfg.database],
    );

    const existing = new Set(cols.map((r) => r.COLUMN_NAME));

    if (!existing.has("failedLoginAttempts")) {
      console.log("Adding failedLoginAttempts column...");
      await conn.execute(
        "ALTER TABLE `Users` ADD COLUMN `failedLoginAttempts` INT NOT NULL DEFAULT 0",
      );
    } else {
      console.log("failedLoginAttempts already exists");
    }

    if (!existing.has("lockedUntil")) {
      console.log("Adding lockedUntil column...");
      await conn.execute(
        "ALTER TABLE `Users` ADD COLUMN `lockedUntil` DATETIME NULL",
      );
    } else {
      console.log("lockedUntil already exists");
    }

    console.log("Checking for unique index on email...");
    const [indexes] = await conn.execute(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'email'`,
      [cfg.database],
    );
    const idxNames = new Set(indexes.map((r) => r.INDEX_NAME));
    if (!idxNames.has("unique_users_email")) {
      try {
        await conn.execute(
          "ALTER TABLE `Users` ADD UNIQUE INDEX `unique_users_email` (`email`)",
        );
        console.log("Added unique index `unique_users_email`");
      } catch (e) {
        console.log(
          "Index creation error (might already exist or duplicates):",
          e.message || e,
        );
      }
    } else {
      console.log("unique_users_email already exists");
    }

    console.log("Done.");
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(
    "Migration script error:",
    err && err.message ? err.message : err,
  );
  process.exit(1);
});
