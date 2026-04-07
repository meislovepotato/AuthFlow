// src/modules/auth/auth.controller.js

import * as authService from "./auth.service.js";
import db from "../../database/index.js";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);

    res.status(201).json({
      message: "User registered",
      data: user,
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;

    const result = await authService.loginUser(req.body, {
      ipAddress,
      userAgent,
    });

    const { accessToken, refreshToken } = result;

    // If redirect params provided, validate client and redirect back with access token
    const redirect_uri = req.body.redirect_uri || req.query.redirect_uri;
    const client_id = req.body.client_id || req.query.client_id;

    if (client_id && redirect_uri) {
      const application = await db.Application.findOne({
        where: { clientId: client_id },
      });
      if (!application)
        return res.status(400).json({ error: "Invalid client_id" });
      if (application.redirectUri !== redirect_uri)
        return res.status(400).json({ error: "Invalid redirect_uri" });

      return res.redirect(`${redirect_uri}?token=${accessToken}`);
    }

    res.json({ message: "Login successful", accessToken, refreshToken });
  } catch (err) {
    console.log("LOGIN BODY:", req.body);
    console.log("LOGIN ERROR:", err && err.message);
    res.status(401).json({ error: err.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ error: "Missing refreshToken" });

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

export const authorize = async (req, res) => {
  try {
    const { client_id, redirect_uri } = req.query;

    if (!client_id || !redirect_uri)
      return res
        .status(400)
        .json({ error: "Missing client_id or redirect_uri" });

    const application = await db.Application.findOne({
      where: { clientId: client_id },
    });
    if (!application)
      return res.status(400).json({ error: "Invalid client_id" });
    if (application.redirectUri !== redirect_uri)
      return res.status(400).json({ error: "Invalid redirect_uri" });

    // If user already has a Bearer token, verify and issue (or forward) a token to the client
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Generate a new token for the client (allows separate expiration if desired)
        const clientToken = authService.generateToken({
          userId: decoded.userId,
          roleId: decoded.roleId,
        });

        return res.redirect(`${redirect_uri}?token=${clientToken}`);
      } catch (err) {
        // invalid token -> fall through to login redirect
      }
    }

    // Not logged in: redirect to login endpoint and include client info so login can finish flow
    const loginUrl = `/api/auth/login?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(
      redirect_uri,
    )}`;
    return res.redirect(loginUrl);
  } catch (err) {
    console.error("AUTHORIZE ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!refreshToken && !accessToken)
      return res.status(400).json({ error: "Missing token" });

    const ok = await authService.revokeSession({ refreshToken, accessToken });
    if (!ok) return res.status(404).json({ error: "Session not found" });

    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};
