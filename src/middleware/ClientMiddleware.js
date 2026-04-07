import db from "../database/index.js";

// validateClient middleware: checks x-client-id and x-client-secret headers
export default function validateClient(req, res, next) {
  const clientId = req.headers["x-client-id"];
  const clientSecret = req.headers["x-client-secret"];

  if (!clientId || !clientSecret) {
    return res.status(401).json({ error: "Missing client credentials" });
  }

  db.Application.findOne({ where: { clientId } })
    .then((app) => {
      if (!app) return res.status(401).json({ error: "Invalid client" });

      // Compare secrets (stored in DB as plain for now) — consider hashing
      if (app.clientSecret !== clientSecret)
        return res.status(401).json({ error: "Invalid client secret" });

      req.client = app; // attach application record
      return next();
    })
    .catch((err) => {
      console.error("ClientMiddleware error:", err && err.message);
      return res.status(500).json({ error: "Server error" });
    });
}
