export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : [req.user.role].filter(Boolean);

    if (allowed.length === 0) return next();

    const ok = userRoles.some((r) => allowed.includes(r));
    if (!ok) {
      return res.status(403).json({
        message: "Forbidden: role required",
        have: userRoles,
        need: allowed,
      });
    }

    next();
  };
}
