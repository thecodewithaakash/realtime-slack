import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminSeedConfig } from "../src/data/seedAdmin.js";

test("admin seeding stays optional when both admin credentials are blank", () => {
  assert.equal(validateAdminSeedConfig({ adminEmail: "", adminPassword: "" }), false);
});

test("admin seeding requires email and password to be configured together", () => {
  assert.throws(
    () => validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "" }),
    /Set both ADMIN_EMAIL and ADMIN_PASSWORD/,
  );
});

test("owner password matches the eight-character registration minimum", () => {
  assert.equal(
    validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "short123" }),
    true,
  );
  assert.throws(
    () => validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "short12" }),
    /ADMIN_PASSWORD must be at least 8 characters.*7 characters, 7 bytes/,
  );
});

test("owner password stays within bcrypt's 72-byte limit", () => {
  assert.throws(
    () => validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "a".repeat(73) }),
    /no more than 72 UTF-8 bytes.*73 characters, 73 bytes/,
  );
  assert.equal(
    validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "a".repeat(72) }),
    true,
  );
});

test("admin seeding accepts valid credentials and rejects invalid emails", () => {
  assert.equal(
    validateAdminSeedConfig({ adminEmail: "owner@example.com", adminPassword: "long-enough-password" }),
    true,
  );
  assert.throws(
    () => validateAdminSeedConfig({ adminEmail: "not-an-email", adminPassword: "long-enough-password" }),
    /ADMIN_EMAIL must be a valid email address/,
  );
});
