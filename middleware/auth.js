// middleware/auth.js
const jwt = require("jsonwebtoken");

/** Extract JWT from common locations */
function getToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  if (req.headers["x-access-token"]) return String(req.headers["x-access-token"]).trim();
  if (req.cookies && req.cookies.token) return String(req.cookies.token).trim();
  return null;
}

/** Strict auth: requires a valid token */
function auth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // e.g. { id, isAdmin, iat, exp }
    // Normalize shape for consistency across codebase
    const userId = decoded.id || decoded._id;
    req.user = {
      ...decoded,
      id: userId,
      _id: userId,
      isAdmin: !!decoded.isAdmin,
      token, // occasionally useful for downstream services
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired, please log in again" });
    }
    return res.status(401).json({ message: "Token is not valid" });
  }
}

/** Optional auth: attaches req.user if token exists; otherwise continues */
function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;
    req.user = { ...decoded, id: userId, _id: userId, isAdmin: !!decoded.isAdmin, token };
  } catch {
    // ignore invalid token in optional mode
  }
  next();
}

/** Gate for admin-only routes */
function adminOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!req.user.isAdmin) return res.status(403).json({ message: "Admin access required" });
  next();
}

module.exports = auth;
// Backward compatible extra exports:
module.exports.optionalAuth = optionalAuth;
module.exports.adminOnly = adminOnly;
