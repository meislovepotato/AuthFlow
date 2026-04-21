import { z } from "zod";
import * as authService from "../auth.service.js";
import db from "../../../database/index.js";
import { auditLog } from "./helpers.js";

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
