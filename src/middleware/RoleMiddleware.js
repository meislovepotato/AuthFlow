export default (allowedRoles) => (req, res, next) => {
  // Ensure authentication middleware has run
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  // Normalize allowed roles to an array
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // Prefer roleId from token (quick-fix B). Support numeric and string IDs.
  const userRoleId = req.user.roleId ?? req.user.role_id ?? req.user.roleId;

  if (typeof userRoleId === "undefined") {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Compare loosely to allow numbers or strings in allowed list
  const match = allowed.some((r) => String(r) === String(userRoleId));
  if (!match) return res.status(403).json({ error: "Forbidden" });

  next();
};
