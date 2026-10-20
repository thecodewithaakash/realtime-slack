import jwt from "jsonwebtoken";
import config from "../config/config.js";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Sign in to join the conversation." });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub).select("_id name email role workspace title");
    if (!user) return res.status(401).json({ message: "This account is no longer available." });
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Your session expired. Sign in again to continue." });
    }
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Workspace owner access is required." });
  }
  return next();
}
