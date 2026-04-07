// src/modules/auth/auth.controller.js

import * as authService from "./auth.service.js";

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
    const result = await authService.loginUser(req.body);

    res.json({
      message: "Login successful",
      ...result,
    });
  } catch (err) {
    console.log("LOGIN BODY:", req.body);
    console.log("LOGIN ERROR:", err && err.message);
    res.status(401).json({ error: err.message });
  }
};
