"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createContextualExpressionController,
} = require("./contextual-expression-controller.cjs");

test("classifies local conversation context and resets after completion", async () => {
  const contexts = [];
  const expressions = [];
  const timers = [];
  const controller = createContextualExpressionController({
    classify: async (context) => {
      contexts.push(context);
      return "happy";
    },
    onExpression: (expression) => expressions.push(expression),
    setTimer: (callback) => {
      timers.push(callback);
      return callback;
    },
    clearTimer: () => {},
  });

  controller.handle({
    type: "assistant_started",
    source: "chatgpt-chrome",
    userText: "How are you?",
  });
  controller.handle({
    type: "assistant_text_delta",
    source: "chatgpt-chrome",
    text: "I am doing wonderfully!",
  });
  await controller.classifyCurrent();
  controller.handle({
    type: "assistant_finished",
    source: "chatgpt-chrome",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(contexts, [
    {
      userText: "How are you?",
      assistantText: "I am doing wonderfully!",
    },
  ]);
  assert.deepEqual(expressions, ["neutral", "happy"]);
  timers.at(-1)();
  assert.deepEqual(expressions, ["neutral", "happy", "neutral"]);
});
