import { z } from "zod";
import * as authService from "../auth.service.js";

export const refresh = async (req, res) => {
  try {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;

    const result = await authService.refreshAccessToken(refreshToken, {
      ipAddress,
      userAgent,
    });

    if (!result)
      return res.status(401).json({ error: "Invalid refresh token" });

    return res.json(result);
  } catch (err) {
    console.error("REFRESH ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};
