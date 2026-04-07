// src/modules/auth/auth.service.js

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../../database/index.js";
import auditLog from "../audit/log.js";

const { User, Role, Session } = db;

export const registerUser = async ({ email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error("Email already exists");

  const role = await Role.findOne({ where: { name: "USER" } });
  if (!role) throw new Error("Role not found");

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,
    roleId: role.id,
  });

  return user;
};

export const loginUser = async (
  { email, password },
  { ipAddress = null, userAgent = null } = {},
) => {
  const user = await User.findOne({ where: { email } });

  if (!user) throw new Error("Invalid credentials");

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error("Invalid credentials");

  // access token short-lived (15 minutes)
  const accessToken = jwt.sign(
    { userId: user.id, roleId: user.roleId },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  // refresh token long-lived — opaque random string
  const refreshToken = crypto.randomBytes(64).toString("hex");

  // store refresh token in Sessions table
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await Session.create({
    token: accessToken,
    expiresAt,
    userId: user.id,
    refreshToken,
    userAgent,
    ipAddress,
  });

  // Audit log: login success
  try {
    await auditLog("LOGIN_SUCCESS", { userId: user.id, ipAddress });
  } catch (err) {}

  return { accessToken, refreshToken, userId: user.id };
};

export const generateToken = (payload, expiresIn = "1h") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const refreshAccessToken = async (
  refreshToken,
  { ipAddress = null, userAgent = null } = {},
) => {
  if (!refreshToken) return null;

  const session = await Session.findOne({ where: { refreshToken } });
  if (!session) return null;

  // Optionally check ipAddress/userAgent matches for extra security
  // if (session.ipAddress && session.ipAddress !== ipAddress) return null;

  // Check expiry
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    // session expired
    await session.destroy();
    return null;
  }

  // Load user to build payload
  const user = await User.findByPk(session.userId);
  if (!user) return null;

  // Issue new access token
  const accessToken = jwt.sign(
    { userId: user.id, roleId: user.roleId },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  // Rotate refresh token
  const newRefreshToken = crypto.randomBytes(64).toString("hex");
  session.refreshToken = newRefreshToken;
  session.token = accessToken;
  session.userAgent = userAgent || session.userAgent;
  session.ipAddress = ipAddress || session.ipAddress;
  await session.save();

  // Audit log: token refresh
  try {
    await auditLog("TOKEN_REFRESH", { userId: user.id, ipAddress });
  } catch (err) {}

  return { accessToken, refreshToken: newRefreshToken };
};
export const revokeSession = async ({
  refreshToken = null,
  accessToken = null,
  ipAddress = null,
} = {}) => {
  if (refreshToken) {
    const session = await Session.findOne({ where: { refreshToken } });
    if (!session) return false;
    const userId = session.userId;
    await session.destroy();
    try {
      await auditLog("LOGOUT", { userId, ipAddress });
    } catch (err) {}
    return true;
  }

  if (accessToken) {
    const session = await Session.findOne({ where: { token: accessToken } });
    if (!session) return false;
    const userId = session.userId;
    await session.destroy();
    try {
      await auditLog("LOGOUT", { userId, ipAddress });
    } catch (err) {}
    return true;
  }

  return false;
};
