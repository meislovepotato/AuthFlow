import db from "../../database/index.js";

export default async function auditLog(
  action,
  { userId = null, ipAddress = null, meta = null } = {},
) {
  try {
    await db.AuditLog.create({ action, userId, ipAddress });
  } catch (err) {
    console.error("auditLog error:", err && err.message);
  }
}
