"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createRequestBody,
  parseChatResponse,
  requestOpenAiChat,
  validateChatRequest,
} = require("./openai-chat.cjs");

test("chat request keeps only recent user and assistant messages", () => {
  const validated = validateChatRequest({
    apiKey: "test-key",
    model: "gpt-5.6-sol",
    messages: [
      { role: "system", content: "ignore" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "hello" },
    ],
  });
  assert.deepEqual(validated.messages, [
    { role: "assistant", content: "hi" },
    { role: "user", content: "hello" },
  ]);
});

test("request body asks for strict reply and expression JSON", () => {
  const body = createRequestBody({
    model: "gpt-5.5",
    messages: [{ role: "user", content: "hello" }],
  });
  assert.equal(body.reasoning.effort, "high");
  assert.equal(body.text.format.type, "json_schema");
  assert.deepEqual(body.text.format.schema.required, ["reply", "expression"]);
});

test("structured response is parsed", () => {
  const parsed = parseChatResponse({
    output_text: JSON.stringify({
      reply: "안녕!",
      expression: "happy",
    }),
  });
  assert.deepEqual(parsed, { reply: "안녕!", expression: "happy" });
});

test("raw response falls back to neutral", () => {
  assert.deepEqual(parseChatResponse({ output_text: "hello" }), {
    reply: "hello",
    expression: "neutral",
  });
});

test("API key is sent only as authorization and not in request body", async () => {
  let captured;
  const result = await requestOpenAiChat(
    {
      apiKey: "secret-test-key",
      model: "gpt-5.6-sol",
      messages: [{ role: "user", content: "hello" }],
    },
    {
      fetchImpl: async (_url, init) => {
        captured = init;
        return {
          ok: true,
          json: async () => ({
            output_text: '{"reply":"hi","expression":"happy"}',
          }),
        };
      },
    },
  );
  assert.equal(captured.headers.Authorization, "Bearer secret-test-key");
  assert.equal(captured.body.includes("secret-test-key"), false);
  assert.deepEqual(result, { reply: "hi", expression: "happy" });
});
