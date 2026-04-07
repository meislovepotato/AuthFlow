// src/modules/auth/auth.service.js

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../../database/index.js";

const { User, Role } = db;

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

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ where: { email } });

  if (!user) throw new Error("Invalid credentials");

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error("Invalid credentials");

  const token = jwt.sign(
    { userId: user.id, roleId: user.roleId },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  return { token };
};

export const generateToken = (payload, expiresIn = "1h") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};
