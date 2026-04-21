import db from "../../../database/index.js";
import jwt from "jsonwebtoken";
import auditLog from "../../audit/log.js";

export const FRONTEND_LOGIN_URL =
  process.env.FRONTEND_LOGIN_URL || "http://localhost:5173/login";
export const AUTH_SESSION_COOKIE_NAME =
  process.env.AUTH_SESSION_COOKIE_NAME || "auth_session";

export const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, pair) => {
    const [name, ...rest] = pair.split("=");
    if (!name) return cookies;
    cookies[name.trim()] = decodeURIComponent((rest || []).join("=").trim());
    return cookies;
  }, {});

export const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[AUTH_SESSION_COOKIE_NAME];
};

export const setSessionCookie = (res, refreshToken) => {
  const secure = process.env.NODE_ENV === "production";
  const allowCrossSite =
    !!process.env.AUTH_COOKIE_DOMAIN ||
    process.env.ALLOW_CROSS_SITE_SSO === "true";
  const cookieOptions = {
    httpOnly: true,
    sameSite: allowCrossSite ? "none" : "lax",
    secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
  if (process.env.AUTH_COOKIE_DOMAIN)
    cookieOptions.domain = process.env.AUTH_COOKIE_DOMAIN;
  res.cookie(AUTH_SESSION_COOKIE_NAME, refreshToken, cookieOptions);
};

export const getAuthenticatedUser = async (req) => {
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

export { auditLog };
