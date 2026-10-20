import assert from "node:assert/strict";
import test from "node:test";
import config, { validateConfig } from "../src/config/config.js";

test("central config exposes the application environment settings", () => {
  assert.equal(Object.isFrozen(config), true);
  assert.equal(typeof config.port, "number");
  assert.equal(typeof config.clientOrigin, "string");
  assert.equal(typeof config.geminiModel, "string");
  assert.equal(typeof config.adminName, "string");
});

test("startup config validation requires MongoDB URI and a strong JWT secret", () => {
  const valid = { mongoUri: "mongodb://localhost:27017/slack-ai", jwtSecret: "s".repeat(32) };
  assert.equal(validateConfig(valid), valid);
  assert.throws(() => validateConfig({ ...valid, mongoUri: "" }), /MONGO_URI is required/);
  assert.throws(() => validateConfig({ ...valid, jwtSecret: "short" }), /JWT_SECRET must be set/);
});
