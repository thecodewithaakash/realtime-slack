import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health endpoint reports the chat API is available", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("workspace APIs reject unauthenticated requests", async () => {
  const response = await fetch(`${baseUrl}/api/channels`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Sign in to join the conversation." });
});

test("workspace admin APIs reject unauthenticated requests", async () => {
  const response = await fetch(`${baseUrl}/api/admin/members`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Sign in to join the conversation." });
});

test("registration validates input before attempting database access", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "A", email: "not-an-email", password: "short" }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /name must be between 2 and 80 characters/i);
});

test("login rejects malformed credentials before database access", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reader@example.com" }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Enter a valid email and password." });
});

test("unknown routes return a structured not-found response", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "That route could not be found." });
});
