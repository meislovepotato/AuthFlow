import express from "express";
import {
  register,
  login,
  authorize,
  token,
  refresh,
  logout,
  clientToken,
} from "./auth.controller.js";
import validateClient from "../../middleware/ClientMiddleware.js";
import { authenticate } from "./auth.middleware.js";
import roleMiddleware from "../../middleware/RoleMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/authorize", authorize);
router.post("/token", token);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/client-token", validateClient, clientToken);

// Example protected route: returns current decoded token payload
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Example admin-only route (roleId 1 = ADMIN per seeders)
router.get("/admin", authenticate, roleMiddleware(1), (req, res) => {
  res.json({ message: "admin access granted" });
});

export default router;
