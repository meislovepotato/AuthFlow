import * as authService from "../auth.service.js";
import auditLog from "../../audit/log.js";

export const clientToken = async (req, res) => {
  try {
    const app = req.client;
    if (!app) return res.status(401).json({ error: "Invalid client" });

    const token = authService.generateToken(
      { clientId: app.clientId, appId: app.id },
      "1h",
    );

    try {
      await auditLog("CLIENT_TOKEN_ISSUED", {
        userId: null,
        ipAddress: req.ip,
      });
    } catch (err) {}

    return res.json({ accessToken: token });
  } catch (err) {
    console.error("CLIENT TOKEN ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};
