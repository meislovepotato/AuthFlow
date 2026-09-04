#!/usr/bin/env node
import "dotenv/config";
import { QueryTypes, Sequelize } from "sequelize";

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    logging: false,
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
    },
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await sequelize.authenticate();
    console.log("Checking for existing columns...");
    const cols = await sequelize.query(
      `SELECT column_name AS "columnName"
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'Users'
         AND column_name IN ('failedLoginAttempts', 'lockedUntil')`,
      { type: QueryTypes.SELECT },
    );

    const existing = new Set(cols.map((row) => row.columnName));

    if (!existing.has("failedLoginAttempts")) {
      console.log("Adding failedLoginAttempts column...");
      await sequelize.query(
        'ALTER TABLE "Users" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0',
      );
    } else {
      console.log("failedLoginAttempts already exists");
    }

    if (!existing.has("lockedUntil")) {
      console.log("Adding lockedUntil column...");
      await sequelize.query(
        'ALTER TABLE "Users" ADD COLUMN "lockedUntil" TIMESTAMP WITH TIME ZONE',
      );
    } else {
      console.log("lockedUntil already exists");
    }

    console.log("Checking for unique index on email...");
    const indexes = await sequelize.query(
      `SELECT indexname AS "indexName"
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = 'Users'
         AND indexdef LIKE '%("email")%'`,
      { type: QueryTypes.SELECT },
    );
    const idxNames = new Set(indexes.map((row) => row.indexName));
    if (!idxNames.has("unique_users_email")) {
      try {
        await sequelize.query(
          'ALTER TABLE "Users" ADD CONSTRAINT "unique_users_email" UNIQUE ("email")',
        );
        console.log("Added unique constraint unique_users_email");
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
    await sequelize.close();
  }
}

run().catch((err) => {
  console.error(
    "Migration script error:",
    err && err.message ? err.message : err,
  );
  process.exit(1);
});
