import { z } from "zod";
import * as authService from "../auth.service.js";
import db from "../../../database/index.js";
import { auditLog, FRONTEND_LOGIN_URL, setSessionCookie } from "./helpers.js";

export const login = async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      // match registration policy
      password: z
        .string()
        .min(12)
        .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W)/, {
          message:
            "Password must include upper, lower, number and special char",
        }),
      client_id: z.string().optional(),
      redirect_uri: z.string().url().optional(),
      state: z.string().optional(),
      code_challenge: z.string().optional(),
      code_challenge_method: z.string().optional(),
    });

    const parsed = schema.parse(req.body);

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;

    const normalizedEmail = parsed.email.trim().toLowerCase();

    const result = await authService.loginUser(
      { email: normalizedEmail, password: parsed.password },
      {
        ipAddress,
        userAgent,
      },
    );

    const { accessToken, refreshToken, userId } = result;
    const redirect_uri = req.body.redirect_uri || req.query.redirect_uri;
    const client_id = req.body.client_id || req.query.client_id;
    const state = req.body.state || req.query.state;
    const code_challenge =
      req.body.code_challenge || req.query.code_challenge || null;
    const code_challenge_method =
      req.body.code_challenge_method || req.query.code_challenge_method || null;

    if (client_id && redirect_uri) {
      const application = await db.Application.findOne({
        where: { clientId: client_id },
      });
      if (!application)
        return res.status(400).json({ error: "Invalid client_id" });
      if (application.redirectUri !== redirect_uri)
        return res.status(400).json({ error: "Invalid redirect_uri" });

      const authCode = await authService.createAuthorizationCode({
        userId,
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
      });
      const code = authCode.code || authCode;

      const params = new URLSearchParams({ code });
      if (state) params.set("state", state);

      return res.redirect(`${redirect_uri}?${params.toString()}`);
    }

    res.json({ message: "Login successful", accessToken, refreshToken });
  } catch (err) {
    console.log("LOGIN BODY:", req.body);
    console.log("LOGIN ERROR:", err && err.message);
    try {
      const found = await db.User.findOne({ where: { email: req.body.email } });
      await auditLog("LOGIN_FAILURE", {
        userId: found ? found.id : null,
        ipAddress: req.ip,
      });
    } catch (e) {
      console.error("AuditLog error (login failure):", e && e.message);
    }
    res.status(401).json({ error: err.message });
  }
};
