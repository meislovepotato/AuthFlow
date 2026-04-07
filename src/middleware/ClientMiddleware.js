import db from "../database/index.js";
import bcrypt from "bcrypt";

// validateClient middleware: checks x-client-id and x-client-secret headers
export default async function validateClient(req, res, next) {
  const clientId = req.headers["x-client-id"];
  const clientSecret = req.headers["x-client-secret"];

  if (!clientId || !clientSecret) {
    return res.status(401).json({ error: "Missing client credentials" });
  }

  try {
    const app = await db.Application.findOne({ where: { clientId } });
    if (!app) return res.status(401).json({ error: "Invalid client" });

    const stored = app.clientSecret || "";
    let ok = false;

    // If stored secret looks like bcrypt hash, use compare
    if (stored.startsWith("$2")) {
      ok = await bcrypt.compare(clientSecret, stored);
    } else {
      ok = stored === clientSecret;
    }

    if (!ok) return res.status(401).json({ error: "Invalid client secret" });

    req.client = app; // attach application record
    return next();
  } catch (err) {
    console.error("ClientMiddleware error:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
}
