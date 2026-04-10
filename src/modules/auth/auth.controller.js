// src/modules/auth/auth.controller.js

import * as authService from "./auth.service.js";
import db from "../../database/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import auditLog from "../audit/log.js";

const FRONTEND_LOGIN_URL =
  process.env.FRONTEND_LOGIN_URL || "http://localhost:5173/login";
const AUTH_SESSION_COOKIE_NAME =
  process.env.AUTH_SESSION_COOKIE_NAME || "auth_session";

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, pair) => {
    const [name, ...rest] = pair.split("=");
    if (!name) return cookies;
    cookies[name.trim()] = decodeURIComponent((rest || []).join("=").trim());
    return cookies;
  }, {});

const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[AUTH_SESSION_COOKIE_NAME];
};

const setSessionCookie = (res, refreshToken) => {
  const secure = process.env.NODE_ENV === "production";
  res.cookie(AUTH_SESSION_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

const getAuthenticatedUser = async (req) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  if (refreshToken) {
    const session = await db.Session.findOne({ where: { refreshToken } });
    if (
      session &&
      (!session.expiresAt || new Date(session.expiresAt) > new Date())
    ) {
      return await db.User.findByPk(session.userId);
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      return jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch (err) {}
  }

  return null;
};

export const register = async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });
    schema.parse(req.body);

    const user = await authService.registerUser(req.body);

    try {
      await auditLog("REGISTER_SUCCESS", {
        userId: user.id,
        ipAddress: req.ip,
      });
    } catch (e) {}

    res.status(201).json({
      message: "User registered",
      data: user,
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err.message);
    try {
      const found = await db.User.findOne({
        where: { email: req.body?.email },
      });
      await auditLog("REGISTER_FAILURE", {
        userId: found ? found.id : null,
        ipAddress: req.ip,
      });
    } catch (e) {}
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      client_id: z.string().optional(),
      redirect_uri: z.string().url().optional(),
      state: z.string().optional(),
    });
    schema.parse(req.body);

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;

    const result = await authService.loginUser(req.body, {
      ipAddress,
      userAgent,
    });

    setSessionCookie(res, result.refreshToken);

    const { accessToken, refreshToken, userId } = result;
    const redirect_uri = req.body.redirect_uri || req.query.redirect_uri;
    const client_id = req.body.client_id || req.query.client_id;
    const state = req.body.state || req.query.state;

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

export const authorize = async (req, res) => {
  try {
    const schema = z.object({
      client_id: z.string(),
      redirect_uri: z.string().url(),
      state: z.string().optional(),
    });
    const { client_id, redirect_uri, state } = schema.parse(req.query);

    await auditLog("APP_AUTH_REQUEST", { userId: null, ipAddress: req.ip });

    const application = await db.Application.findOne({
      where: { clientId: client_id },
    });
    if (!application)
      return res.status(400).json({ error: "Invalid client_id" });
    if (application.redirectUri !== redirect_uri)
      return res.status(400).json({ error: "Invalid redirect_uri" });

    const user = await getAuthenticatedUser(req);
    const userId = user?.id || user?.userId || null;
    if (userId) {
      const authCode = await authService.createAuthorizationCode({
        userId,
        clientId: client_id,
        redirectUri: redirect_uri,
      });
      const code = authCode.code || authCode;

      try {
        await auditLog("APP_AUTH_GRANTED", {
          userId,
          ipAddress: req.ip,
        });
      } catch (e) {}

      const params = new URLSearchParams({ code });
      if (state) params.set("state", state);
      return res.redirect(`${redirect_uri}?${params.toString()}`);
    }

    const loginUrl = `${FRONTEND_LOGIN_URL}?client_id=${encodeURIComponent(
      client_id,
    )}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    return res.redirect(loginUrl);
  } catch (err) {
    console.error("AUTHORIZE ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

export const token = async (req, res) => {
  try {
    const schema = z.object({
      grant_type: z.literal("authorization_code"),
      code: z.string(),
      client_id: z.string(),
      redirect_uri: z.string().url(),
      client_secret: z.string().optional(),
    });
    const { code, client_id, redirect_uri, client_secret } = schema.parse(
      req.body,
    );

    const application = await db.Application.findOne({
      where: { clientId: client_id },
    });
    if (!application)
      return res.status(400).json({ error: "Invalid client_id" });
    if (application.redirectUri !== redirect_uri)
      return res.status(400).json({ error: "Invalid redirect_uri" });

    if (application.clientSecret) {
      const storedSecret = application.clientSecret;
      const isHashed = storedSecret.startsWith("$2");
      const validSecret = isHashed
        ? await bcrypt.compare(client_secret || "", storedSecret)
        : storedSecret === client_secret;

      if (!validSecret)
        return res.status(401).json({ error: "Invalid client_secret" });
    }

    const authCode = await authService.consumeAuthorizationCode({
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
    });
    if (!authCode)
      return res
        .status(400)
        .json({ error: "Invalid or expired authorization code" });

    const user = await db.User.findByPk(authCode.userId);
    if (!user)
      return res.status(400).json({ error: "Invalid authorization code user" });

    const session = await authService.createSession({
      user,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.json({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      token_type: "Bearer",
      expires_in: 15 * 60,
    });
  } catch (err) {
    console.error("TOKEN ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const schema = z.object({ refreshToken: z.string().optional() });
    const { refreshToken } = schema.parse(req.body || {});
    const authHeader = req.headers.authorization;
    const accessToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    const cookieRefreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken && !accessToken && !cookieRefreshToken)
      return res.status(400).json({ error: "Missing token" });

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"] || null;

    const ok = await authService.revokeSession({
      refreshToken: refreshToken || cookieRefreshToken,
      accessToken,
      ipAddress,
      userAgent,
    });
    if (!ok) return res.status(404).json({ error: "Session not found" });

    res.clearCookie(AUTH_SESSION_COOKIE_NAME, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err && err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

export const clientToken = async (req, res) => {
  try {
    const app = req.client;
    if (!app) return res.status(401).json({ error: "Invalid client" });

    // Issue an access token for the client (machine-to-machine)
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
