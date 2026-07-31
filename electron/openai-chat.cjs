"use strict";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ALLOWED_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "surprised",
  "embarrassed",
  "angry",
];
const ALLOWED_MODELS = new Map([
  ["gpt-5.5", { reasoning: "high" }],
  ["gpt-5.6-sol", { reasoning: "medium" }],
]);

function validateChatRequest(request) {
  const apiKey = String(request?.apiKey ?? "").trim();
  const model = String(request?.model ?? "");
  const messages = Array.isArray(request?.messages)
    ? request.messages
        .filter(
          (message) =>
            (message?.role === "user" || message?.role === "assistant") &&
            typeof message?.content === "string" &&
            message.content.trim(),
        )
        .slice(-12)
        .map((message) => ({
          role: message.role,
          content: message.content.trim().slice(0, 12_000),
        }))
    : [];

  if (!apiKey) throw new Error("OpenAI API key를 입력해 주세요.");
  if (!ALLOWED_MODELS.has(model)) {
    throw new Error("지원하지 않는 모델입니다.");
  }
  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    throw new Error("보낼 사용자 메시지가 없습니다.");
  }
  return { apiKey, messages, model };
}

function createRequestBody({ messages, model }) {
  const modelSettings = ALLOWED_MODELS.get(model);
  return {
    model,
    reasoning: { effort: modelSettings.reasoning },
    instructions: [
      "Reply naturally and warmly to the user.",
      "Choose exactly one facial expression that fits your reply.",
      "Use neutral when no stronger expression is appropriate.",
      "Return only the requested structured result.",
    ].join(" "),
    input: messages,
    text: {
      format: {
        type: "json_schema",
        name: "persona_chat_reply",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply: { type: "string" },
            expression: {
              type: "string",
              enum: ALLOWED_EXPRESSIONS,
            },
          },
          required: ["reply", "expression"],
        },
      },
    },
  };
}

function responseOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function parseChatResponse(payload) {
  const outputText = responseOutputText(payload).trim();
  if (!outputText) throw new Error("모델이 빈 답변을 보냈습니다.");
  try {
    const parsed = JSON.parse(outputText);
    if (
      typeof parsed?.reply === "string" &&
      ALLOWED_EXPRESSIONS.includes(parsed?.expression)
    ) {
      return {
        reply: parsed.reply.trim(),
        expression: parsed.expression,
      };
    }
  } catch {
    // A raw reply is still useful if a provider ignores the JSON schema.
  }
  return { reply: outputText, expression: "neutral" };
}

async function requestOpenAiChat(request, { fetchImpl = fetch } = {}) {
  const validated = validateChatRequest(request);
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${validated.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createRequestBody(validated)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : `OpenAI API 요청 실패 (${response.status})`;
    throw new Error(detail);
  }
  return parseChatResponse(payload);
}

module.exports = {
  ALLOWED_EXPRESSIONS,
  createRequestBody,
  parseChatResponse,
  requestOpenAiChat,
  validateChatRequest,
};
