"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  chromeChatEventToBridgeEvents,
} = require("./chrome-chat-events.cjs");

test("Chrome assistant activity maps to Speaking and Idle", () => {
  const started = chromeChatEventToBridgeEvents({
    type: "assistant_started",
    source: "chatgpt-chrome",
  });
  const delta = chromeChatEventToBridgeEvents({
    type: "assistant_text_delta",
    text: "hello",
    source: "chatgpt-chrome",
  });
  const finished = chromeChatEventToBridgeEvents({
    type: "assistant_finished",
    source: "chatgpt-chrome",
  });

  assert.deepEqual(started[0], { type: "text-speaking", active: true });
  assert.equal(started[1].state.activity, "speaking");
  assert.equal(started[2].type, "audio-level");
  assert.ok(started[2].level > 0);
  assert.deepEqual(delta[0], { type: "text-speaking", active: true });
  assert.equal(delta[1].state.activity, "speaking");
  assert.equal(delta[2].type, "audio-level");
  assert.ok(delta[2].level > 0);
  assert.deepEqual(finished[0], { type: "text-speaking", active: false });
  assert.deepEqual(finished[1], { type: "audio-level", level: 0 });
  assert.equal(finished[2].state.activity, "idle");
  assert.equal(finished[2].state.phase, "inactive");
});

test("ignores events that did not come from the Chrome bridge", () => {
  assert.equal(
    chromeChatEventToBridgeEvents({ type: "assistant_started" }),
    null,
  );
});
