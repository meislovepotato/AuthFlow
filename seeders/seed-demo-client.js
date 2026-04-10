import db from "../src/database/index.js";
async function seed() {
  try {
    await db.sequelize.sync(); // ensure tables exist
    await db.Application.create({
      name: "Demo App",
      clientId: "demo-client",
      clientSecret: "secret123",
      redirectUri: "http://localhost:5173/callback",
    });
    console.log("✅ Demo client created!");
    process.exit(0); // exit after finishing
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();