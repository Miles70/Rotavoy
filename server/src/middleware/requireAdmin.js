import { verifyAdminToken } from "../utils/adminAuth.js";

export function requireAdmin(request, response, next) {
  try {
    const authorization = String(request.headers.authorization || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return response.status(401).json({ message: "Admin login is required." });
    }

    request.adminToken = match[1];
    request.admin = verifyAdminToken(request.adminToken);
    return next();
  } catch (error) {
    return next(error);
  }
}
