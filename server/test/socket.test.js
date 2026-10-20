import assert from "node:assert/strict";
import test from "node:test";
import { channelRoom } from "../src/socket.js";

test("channel messages use isolated Socket.IO rooms", () => {
  assert.equal(channelRoom("channel-one"), "channel:channel-one");
  assert.notEqual(channelRoom("channel-one"), channelRoom("channel-two"));
});
