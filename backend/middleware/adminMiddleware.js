import { requireAuth } from "./authMiddleware.js";

function parseList(value = "") {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminUser(user = {}) {
  const adminEmails = parseList(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "");
  const adminUserIds = parseList(process.env.ADMIN_USER_IDS || process.env.ADMIN_USER_ID || "");
  const email = String(user.email || "").trim().toLowerCase();
  const id = String(user.id || "").trim().toLowerCase();

  return Boolean(
    (email && adminEmails.has(email)) ||
      (id && adminUserIds.has(id))
  );
}

export function withAdminFlag(user = {}) {
  if (!user) {
    return user;
  }

  return {
    ...user,
    is_admin: isAdminUser(user)
  };
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!isAdminUser(req.user)) {
      res.status(403).json({
        success: false,
        error: "Acesso administrativo restrito."
      });
      return;
    }

    req.user = withAdminFlag(req.user);
    next();
  });
}
