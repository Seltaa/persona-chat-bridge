"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  contextualInput,
  createLocalExpressionClassifier,
  expressionFromResult,
} = require("./local-expression-classifier.cjs");

test("builds context from both sides of the exchange", () => {
  assert.equal(
    contextualInput({
      userText: "오늘 어땠어?",
      assistantText: "정말 즐거웠어!",
    }),
    "User:\n오늘 어땠어?\n\nAssistant:\n정말 즐거웠어!",
  );
});

test("maps multilingual model emotions to Persona expressions", () => {
  assert.equal(
    expressionFromResult([
      { label: "joy", score: 0.9 },
      { label: "neutral", score: 0.1 },
    ]),
    "happy",
  );
  assert.equal(
    expressionFromResult([
      { label: "disgust", score: 0.42 },
      { label: "sadness", score: 0.24 },
      { label: "surprise", score: 0.2 },
    ]),
    "embarrassed",
  );
  assert.equal(
    expressionFromResult([
      { label: "surprise", score: 0.44 },
      { label: "fear", score: 0.43 },
    ]),
    "embarrassed",
  );
  assert.equal(
    expressionFromResult([
      { label: "disgust", score: 0.5 },
      { label: "anger", score: 0.3 },
    ]),
    "angry",
  );
});

test("loads once and classifies through an injected local pipeline", async () => {
  let loadCount = 0;
  const classifier = createLocalExpressionClassifier({
    loadPipeline: async () => {
      loadCount += 1;
      return async () => [
        { label: "joy", score: 0.9 },
        { label: "neutral", score: 0.1 },
      ];
    },
  });

  assert.equal(
    await classifier.classify({
      userText: "Tell me the news",
      assistantText: "Wonderful news!",
    }),
    "happy",
  );
  await classifier.preload();
  assert.equal(loadCount, 1);
});
