import dotenv from "dotenv";

dotenv.config();

const config = Object.freeze({
  port: Number(process.env.PORT) || 4001,
  mongoUri: process.env.MONGO_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  adminName: process.env.ADMIN_NAME || "Workspace Owner",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
});

export function validateConfig(settings = config) {
  if (!settings.mongoUri) {
    throw new Error("MONGO_URI is required to connect to MongoDB.");
  }
  if (settings.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a secret with at least 32 characters.");
  }
  return settings;
}

export default config;
